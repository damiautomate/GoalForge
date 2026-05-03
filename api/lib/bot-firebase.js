// Server-side Firebase for the WhatsApp bot
// Reads user goals, habits, plans to give AI coach full context

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

function init() {
  if (getApps().length === 0) {
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    initializeApp({ credential: cert(key), projectId: process.env.FIREBASE_PROJECT_ID });
  }
  db = getFirestore();
}

function getDb() {
  if (!db) init();
  return db;
}

// ── User lookup by phone number ──

export async function getUserByPhone(phone) {
  const clean = phone.replace('whatsapp:', '').replace(/\s/g, '');
  const snap = await getDb().collection('users').where('phone', '==', clean).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}

// ── Get all user context for AI coach ──

export async function getFullContext(uid) {
  const db = getDb();
  const now = new Date();
  const year = String(now.getFullYear());
  const month = now.getMonth() + 1;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  const weekNum = Math.ceil(now.getDate() / 7);

  const ctx = {
    date: today,
    dayName: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()],
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }),
    monthName: now.toLocaleString('en', { month: 'long' }),
    daysLeft: new Date(now.getFullYear(), month, 0).getDate() - now.getDate(),
  };

  try {
    // User profile (for enrichment data)
    const userDoc = await db.doc(`users/${uid}`).get();
    if (userDoc.exists) {
      const u = userDoc.data();
      if (u.profileEnrichment && typeof u.profileEnrichment === 'object') {
        ctx.profileEnrichment = u.profileEnrichment;
      }
    }

    // Yearly plan
    const yearDoc = await db.doc(`yearlyPlans/${uid}/${year}/plan`).get();
    if (yearDoc.exists) {
      const y = yearDoc.data();
      ctx.yearlyPlan = {
        vision: y.vision,
        wordOfYear: y.wordOfYear,
        incomeGoal: y.income?.total,
        monthlyTarget: y.income?.monthlyTarget,
        nmTargetRank: y.networkMarketing?.targetRank,
        nmRecruitPace: y.networkMarketing?.recruitmentPace,
        books: y.personalDev?.books || [],
        dailyIPAs: y.dailyStructure?.dailyIPAs || [],
        habitLock: y.dailyStructure?.habitLock,
      };
    }

    // Monthly goals
    const goalsSnap = await db.collection(`monthlyGoals/${uid}/${ym}`).get();
    ctx.monthlyGoals = [];
    goalsSnap.forEach(d => {
      const g = d.data();
      const pctDone = g.target ? Math.round(((g.current || 0) / g.target) * 100) : 0;
      ctx.monthlyGoals.push({
        title: g.title, type: g.type, target: g.target,
        current: g.current || 0, unit: g.unit, pct: pctDone,
        category: g.category,
      });
    });

    // 66-day habit
    const habitsSnap = await db.collection(`habits66/${uid}`).get();
    habitsSnap.forEach(d => {
      const h = d.data();
      if (h.status === 'active') {
        ctx.activeHabit = {
          title: h.title, currentDay: h.currentDay, targetDays: h.targetDays,
          missedYesterday: h.missedYesterday, resets: h.resets || 0,
        };
      }
    });

    // Weekly plan
    const weekDoc = await db.doc(`weeklyPlans/${uid}/${ym}/week${weekNum}`).get();
    if (weekDoc.exists) {
      const w = weekDoc.data();
      const actions = w.actions || [];
      ctx.weeklyPlan = {
        theme: w.theme,
        totalActions: actions.length,
        completedActions: actions.filter(a => a.completed).length,
        pendingActions: actions.filter(a => !a.completed).map(a => a.title),
      };
    }

    // Today's sheet data
    const sheetDoc = await db.doc(`sheetLinks/${uid}/${ym}/info`).get();
    if (sheetDoc.exists) {
      ctx.hasSheet = true;
    }

    // Today's tasks from Firebase
    const dailyDoc = await db.doc(`dailyTasks/${uid}/${today}`).get();
    if (dailyDoc.exists) {
      const d = dailyDoc.data();
      ctx.todayTasks = {
        total: d.tasks?.length || 0,
        done: d.tasks?.filter(t => t.completed).length || 0,
        progress: d.progress || 0,
      };
    }

    // Assigned tasks (from team leader)
    const assignedSnap = await db.collection('assignedTasks')
      .where('assignedTo', 'array-contains', uid)
      .where('status', '!=', 'completed')
      .limit(5).get();
    ctx.assignedTasks = [];
    assignedSnap.forEach(d => {
      const t = d.data();
      const completion = t.completions?.[uid];
      if (!completion?.done) {
        ctx.assignedTasks.push({
          description: t.description,
          deadline: t.deadline,
          proofRequired: t.proofRequired,
          fineAmount: t.fineAmount,
        });
      }
    });

    // Past month report for context
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
    const reportDoc = await db.doc(`monthlyReports/${uid}/${prevYm}`).get();
    if (reportDoc.exists) {
      ctx.lastMonthReport = reportDoc.data();
    }

  } catch (e) {
    console.error('Context fetch error:', e.message);
  }

  return ctx;
}

// ── Conversation history ──

export async function getConversationHistory(uid) {
  const doc = await getDb().doc(`botConversations/${uid}`).get();
  return doc.exists ? (doc.data().messages || []) : [];
}

export async function addToHistory(uid, role, text) {
  const db = getDb();
  const ref = db.doc(`botConversations/${uid}`);
  const doc = await ref.get();
  const messages = doc.exists ? (doc.data().messages || []) : [];
  messages.push({ role, text: text.slice(0, 500), time: Date.now() });
  // Keep last 20 messages
  await ref.set({ messages: messages.slice(-20) });
}

// ── Day tracking for cron ──

export async function getCronState(uid) {
  const today = new Date().toISOString().slice(0, 10);
  const doc = await getDb().doc(`botCronState/${uid}`).get();
  if (!doc.exists || doc.data().date !== today) {
    return { date: today, phasesSent: [], allDoneNotified: false };
  }
  return doc.data();
}

export async function setCronState(uid, state) {
  await getDb().doc(`botCronState/${uid}`).set(state);
}

// ── Update goal progress via bot ──

export async function updateGoalFromBot(uid, goalTitle, newValue) {
  const db = getDb();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const goalsSnap = await db.collection(`monthlyGoals/${uid}/${ym}`).get();

  let updated = false;
  for (const doc of goalsSnap.docs) {
    const g = doc.data();
    if (g.title.toLowerCase().includes(goalTitle.toLowerCase())) {
      await doc.ref.update({ current: newValue });
      updated = true;
      break;
    }
  }
  return updated;
}

// ── Mark habit done via bot ──

export async function markHabitFromBot(uid, done) {
  const db = getDb();
  const habitsSnap = await db.collection(`habits66/${uid}`).get();

  for (const doc of habitsSnap.docs) {
    const h = doc.data();
    if (h.status !== 'active') continue;

    const today = new Date().toISOString().slice(0, 10);
    const history = [...(h.history || [])];
    const existing = history.findIndex(e => e.date === today);
    if (existing >= 0) history[existing] = { date: today, completed: done };
    else history.push({ date: today, completed: done });

    let { currentDay, missedYesterday, resets, status } = h;
    if (done) {
      currentDay = history.filter(e => e.completed).length;
      missedYesterday = false;
      if (currentDay >= h.targetDays) status = 'completed';
    } else {
      if (missedYesterday) { resets += 1; currentDay = 0; missedYesterday = false; }
      else missedYesterday = true;
    }

    await doc.ref.update({ history, currentDay, missedYesterday, resets, status });
    return { title: h.title, currentDay, targetDays: h.targetDays, status };
  }
  return null;
}

// ── Get all registered bot users (for cron) ──

export async function getBotUsers() {
  const snap = await getDb().collection('users').where('phone', '!=', null).get();
  const users = [];
  snap.forEach(d => users.push({ uid: d.id, ...d.data() }));
  return users;
}
