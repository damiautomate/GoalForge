// Server-side Firebase operations for the WhatsApp bot
import { getDb, getWATTime } from './_config.js';

// ── User lookup by phone number ──
export async function getUserByPhone(phone) {
  const db = getDb();
  // phone comes as "whatsapp:+234..." — strip prefix
  const cleaned = phone.replace('whatsapp:', '').trim();
  const snap = await db.collection('users').where('phone', '==', cleaned).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}

// ── Full goal context for AI coach ──
export async function getGoalContext(uid) {
  const db = getDb();
  const t = getWATTime();

  const context = {
    yearlyPlan: null,
    monthlyGoals: [],
    weeklyPlan: null,
    activeHabit: null,
    todayTasks: null,
    assignedTasks: [],
  };

  try {
    // Yearly plan
    const ySnap = await db.doc(`yearlyPlans/${uid}/${t.year}/plan`).get();
    if (ySnap.exists) {
      const y = ySnap.data();
      context.yearlyPlan = {
        vision: y.vision,
        wordOfYear: y.wordOfYear,
        motivation: y.motivation,
        incomeGoal: y.income?.total,
        monthlyTarget: y.income?.monthlyTarget,
      };
    }

    // Monthly goals
    const gSnap = await db.collection(`monthlyGoals/${uid}/${t.ym}`).get();
    gSnap.forEach(d => {
      const g = d.data();
      const pctDone = g.target ? Math.round(((g.current || 0) / g.target) * 100) : 0;
      context.monthlyGoals.push({
        id: d.id, title: g.title, type: g.type,
        current: g.current || 0, target: g.target, unit: g.unit,
        category: g.category, progress: pctDone,
      });
    });

    // Weekly plan
    const weekNum = Math.ceil(t.date / 7);
    const wSnap = await db.doc(`weeklyPlans/${uid}/${t.ym}/week${weekNum}`).get();
    if (wSnap.exists) {
      const w = wSnap.data();
      const actions = (w.actions || []);
      const done = actions.filter(a => a.completed).length;
      context.weeklyPlan = {
        theme: w.theme,
        totalActions: actions.length,
        completedActions: done,
        pendingActions: actions.filter(a => !a.completed).map(a => a.title),
      };
    }

    // Active 66-day habit
    const hSnap = await db.collection(`habits66/${uid}`).where('status', '==', 'active').limit(1).get();
    if (!hSnap.empty) {
      const h = hSnap.docs[0].data();
      const hist = h.history || [];
      const doneCount = hist.filter(d => d.completed).length;
      context.activeHabit = {
        title: h.title,
        currentDay: h.currentDay,
        targetDays: h.targetDays,
        missedYesterday: h.missedYesterday,
        consistency: hist.length ? Math.round((doneCount / hist.length) * 100) : 0,
        resets: h.resets || 0,
      };
    }

    // Today's daily tasks (from sheet sync)
    const dSnap = await db.doc(`dailyTasks/${uid}/${t.iso}`).get();
    if (dSnap.exists) {
      const d = dSnap.data();
      context.todayTasks = {
        doneCount: d.doneCount || 0,
        totalTasks: (d.tasks || []).length,
        progress: d.progress || 0,
      };
    }

    // Assigned tasks (pending)
    const aSnap = await db.collection('assignedTasks')
      .where('assignedTo', 'array-contains', uid)
      .get();
    aSnap.forEach(d => {
      const a = d.data();
      const myCompletion = a.completions?.[uid];
      if (!myCompletion?.done) {
        context.assignedTasks.push({
          description: a.description,
          deadline: a.deadline,
          assignedBy: a.createdBy,
          proofRequired: a.proofRequired,
          fineAmount: a.fineAmount,
        });
      }
    });
  } catch (e) {
    console.error('Error loading goal context:', e);
  }

  return context;
}

// ── Conversation history ──
export async function getConversationHistory(uid) {
  const db = getDb();
  const doc = await db.doc(`botState/${uid}/config/chatHistory`).get();
  return doc.exists ? (doc.data().messages || []) : [];
}

export async function addToHistory(uid, role, text) {
  const db = getDb();
  const ref = db.doc(`botState/${uid}/config/chatHistory`);
  const doc = await ref.get();
  const messages = doc.exists ? (doc.data().messages || []) : [];
  messages.push({ role, text, time: Date.now() });
  const trimmed = messages.slice(-20); // Keep last 10 exchanges
  await ref.set({ messages: trimmed });
}

// ── Phase tracking (prevent double-sends) ──
export async function wasPhaseSent(uid, phase) {
  const db = getDb();
  const t = getWATTime();
  const doc = await db.doc(`botState/${uid}/phases/${t.iso}`).get();
  return doc.exists ? !!doc.data()[phase] : false;
}

export async function recordPhase(uid, phase) {
  const db = getDb();
  const t = getWATTime();
  await db.doc(`botState/${uid}/phases/${t.iso}`).set({ [phase]: true }, { merge: true });
}

// ── Get all active bot users ──
export async function getActiveBotUsers() {
  const db = getDb();
  const snap = await db.collection('users').where('phone', '!=', null).get();
  const users = [];
  snap.forEach(d => users.push({ uid: d.id, ...d.data() }));
  return users;
}

// ── Mark habit done via bot ──
export async function markHabitDoneViaBot(uid) {
  const db = getDb();
  const hSnap = await db.collection(`habits66/${uid}`).where('status', '==', 'active').limit(1).get();
  if (hSnap.empty) return { success: false, message: 'No active habit.' };

  const hDoc = hSnap.docs[0];
  const h = hDoc.data();
  const t = getWATTime();
  const history = [...(h.history || [])];
  const existing = history.findIndex(e => e.date === t.iso);
  if (existing >= 0) {
    history[existing] = { date: t.iso, completed: true };
  } else {
    history.push({ date: t.iso, completed: true });
  }

  const currentDay = history.filter(e => e.completed).length;
  const status = currentDay >= h.targetDays ? 'completed' : 'active';

  await hDoc.ref.update({ history, currentDay, missedYesterday: false, status });

  return {
    success: true,
    title: h.title,
    currentDay,
    targetDays: h.targetDays,
    completed: status === 'completed',
  };
}

// ── Update monthly goal progress via bot ──
export async function updateGoalViaBot(uid, goalTitle, newValue) {
  const db = getDb();
  const t = getWATTime();
  const gSnap = await db.collection(`monthlyGoals/${uid}/${t.ym}`).get();

  let found = null;
  gSnap.forEach(d => {
    const g = d.data();
    if (g.title.toLowerCase().includes(goalTitle.toLowerCase())) {
      found = { ref: d.ref, data: g };
    }
  });

  if (!found) return { success: false, message: `Couldn't find a goal matching "${goalTitle}".` };

  await found.ref.update({ current: newValue });
  const pct = found.data.target ? Math.round((newValue / found.data.target) * 100) : 0;

  return {
    success: true,
    title: found.data.title,
    current: newValue,
    target: found.data.target,
    unit: found.data.unit,
    progress: pct,
  };
}
