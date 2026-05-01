// Team service — handles team creation, joining, member tree, and invite codes
import { db, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from './firebase';
import { query, where, limit } from 'firebase/firestore';

// ── Generate unique invite code ──
export function generateInviteCode(prefix = 'TEAM') {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  const year = new Date().getFullYear();
  return `${prefix}${year}-${random}`;
}

// ── Generate Member ID (LTMID-style) ──
export function generateMemberId(prefix = 'MID') {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

// ── Create a new team ──
export async function createTeam({ name, leaderUid, leaderName, fineDefault = 200 }) {
  const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const inviteCode = generateInviteCode(name.replace(/\s/g, '').slice(0, 4).toUpperCase());

  await setDoc(doc(db, 'teams', teamId), {
    name,
    leaderId: leaderUid,
    leaderName,
    inviteCode,
    fineDefault,
    memberCount: 1,
    createdAt: serverTimestamp(),
  });

  // Update leader's profile to mark them as part of this team
  const leaderMemberId = generateMemberId(name.slice(0, 3).toUpperCase());
  await updateDoc(doc(db, 'users', leaderUid), {
    teamId,
    teamRole: 'leader',
    memberId: leaderMemberId,
    uplineId: null,
    ancestorIds: [],
    joinedTeamAt: serverTimestamp(),
  });

  return { teamId, inviteCode, memberId: leaderMemberId };
}

// ── Join a team via invite code ──
export async function joinTeamByCode({ inviteCode, userUid, userName, uplineMemberId }) {
  // Find team by invite code
  const teamSnap = await getDocs(query(collection(db, 'teams'), where('inviteCode', '==', inviteCode), limit(1)));
  if (teamSnap.empty) throw new Error('Invalid invite code');

  const teamDoc = teamSnap.docs[0];
  const teamId = teamDoc.id;
  const team = teamDoc.data();

  // Determine upline (defaults to leader if no uplineMemberId given)
  let uplineUid = team.leaderId;
  let ancestorIds = [team.leaderId];

  if (uplineMemberId) {
    const uplineUser = await findUserByMemberId(uplineMemberId);
    if (uplineUser) {
      uplineUid = uplineUser.uid;
      ancestorIds = [...(uplineUser.ancestorIds || []), uplineUser.uid];
    }
  }

  const memberId = generateMemberId(team.name.slice(0, 3).toUpperCase());

  await updateDoc(doc(db, 'users', userUid), {
    teamId,
    teamRole: 'member',
    memberId,
    uplineId: uplineUid,
    ancestorIds,
    joinedTeamAt: serverTimestamp(),
  });

  // Increment team member count
  await updateDoc(doc(db, 'teams', teamId), {
    memberCount: (team.memberCount || 1) + 1,
  });

  return { teamId, memberId, uplineUid };
}

// ── Join via member ID (find their team and join under them) ──
export async function joinTeamByMemberId({ memberId, userUid, userName }) {
  const upline = await findUserByMemberId(memberId);
  if (!upline) throw new Error('Member ID not found');
  if (!upline.teamId) throw new Error('That member is not in a team');

  return joinTeamByCode({
    inviteCode: null, // bypass code lookup
    userUid, userName,
    uplineMemberId: memberId,
    teamIdOverride: upline.teamId,
  });
}

// ── Find user by Member ID ──
export async function findUserByMemberId(memberId) {
  const snap = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberId), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

// ── Get team info ──
export async function getTeam(teamId) {
  const snap = await getDoc(doc(db, 'teams', teamId));
  return snap.exists() ? { id: teamId, ...snap.data() } : null;
}

// ── Get all team members (flat list) ──
export async function getTeamMembers(teamId) {
  const snap = await getDocs(query(collection(db, 'users'), where('teamId', '==', teamId)));
  const members = [];
  snap.forEach(d => members.push({ uid: d.id, ...d.data() }));
  return members;
}

// ── Get direct downline of a user ──
export async function getDirectDownline(uid) {
  const snap = await getDocs(query(collection(db, 'users'), where('uplineId', '==', uid)));
  const downline = [];
  snap.forEach(d => downline.push({ uid: d.id, ...d.data() }));
  return downline;
}

// ── Build full downline tree (recursive) ──
export async function getDownlineTree(uid) {
  const direct = await getDirectDownline(uid);
  const tree = [];
  for (const member of direct) {
    const subTree = await getDownlineTree(member.uid);
    tree.push({ ...member, downline: subTree });
  }
  return tree;
}

// ── Get all downline UIDs (flattened, for task assignment) ──
export async function getAllDownlineUids(uid) {
  const tree = await getDownlineTree(uid);
  const uids = [];
  function walk(nodes) {
    for (const n of nodes) {
      uids.push(n.uid);
      if (n.downline) walk(n.downline);
    }
  }
  walk(tree);
  return uids;
}

// ── Get user's progress summary for team display ──
export async function getMemberProgressSummary(uid) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const today = now.toISOString().slice(0, 10);

  const [goalsSnap, habitsSnap, todayDoc] = await Promise.all([
    getDocs(collection(db, 'monthlyGoals', uid, ym)),
    getDocs(collection(db, 'habits66', uid)),
    getDoc(doc(db, 'dailyTasks', uid, today)),
  ]);

  let goalCount = 0, completedGoals = 0, totalProgress = 0;
  goalsSnap.forEach(d => {
    const g = d.data();
    goalCount++;
    const pct = g.target ? Math.round(((g.current || 0) / g.target) * 100) : 0;
    totalProgress += pct;
    if (pct >= 100) completedGoals++;
  });

  let habitDay = 0, habitTotal = 0;
  habitsSnap.forEach(d => {
    const h = d.data();
    if (h.status === 'active') {
      habitDay = h.currentDay;
      habitTotal = h.targetDays;
    }
  });

  let todayProgress = 0;
  if (todayDoc.exists()) {
    todayProgress = Math.round((todayDoc.data().progress || 0) * 100);
  }

  return {
    goalCount, completedGoals,
    avgProgress: goalCount ? Math.round(totalProgress / goalCount) : 0,
    habitDay, habitTotal,
    todayProgress,
  };
}

// ── Assigned tasks ──

export async function createAssignedTask({
  teamId, assignedBy, assignedByName, description,
  type = 'one_time', recurrencePattern = null, deadline,
  proofRequired = false, proofType = 'text', fineAmount = 200,
  scope = 'direct', specificMembers = [], excludedFromFines = [],
}) {
  // Determine assignedTo based on scope
  let assignedTo = [];
  if (scope === 'direct') {
    const direct = await getDirectDownline(assignedBy);
    assignedTo = direct.map(m => m.uid);
  } else if (scope === 'tree') {
    assignedTo = await getAllDownlineUids(assignedBy);
  } else if (scope === 'specific') {
    assignedTo = specificMembers;
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const completions = {};
  assignedTo.forEach(uid => { completions[uid] = { done: false }; });

  await setDoc(doc(db, 'assignedTasks', taskId), {
    teamId, assignedBy, assignedByName, description,
    type, recurrencePattern, deadline,
    proofRequired, proofType, fineAmount,
    scope, assignedTo, excludedFromFines,
    status: 'active', completions,
    createdAt: serverTimestamp(),
  });

  return taskId;
}

export async function getAssignedTasksForUser(uid) {
  const snap = await getDocs(query(collection(db, 'assignedTasks'), where('assignedTo', 'array-contains', uid)));
  const tasks = [];
  snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
  return tasks.sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
}

export async function getAssignedTasksByLeader(leaderUid) {
  const snap = await getDocs(query(collection(db, 'assignedTasks'), where('assignedBy', '==', leaderUid)));
  const tasks = [];
  snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
  return tasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function completeAssignedTask({ taskId, uid, proof = '' }) {
  const taskRef = doc(db, 'assignedTasks', taskId);
  const taskDoc = await getDoc(taskRef);
  if (!taskDoc.exists()) throw new Error('Task not found');

  const completions = { ...(taskDoc.data().completions || {}) };
  completions[uid] = { done: true, doneAt: new Date().toISOString(), proof };
  await updateDoc(taskRef, { completions });

  return true;
}

// ── Edit / delete an assigned task (leader only) ──
export async function updateAssignedTask(taskId, updates) {
  await updateDoc(doc(db, 'assignedTasks', taskId), updates);
}

export async function deleteAssignedTask(taskId) {
  await deleteDoc(doc(db, 'assignedTasks', taskId));
}

// ── Member earnings (leader views aggregate across team) ──
export async function getMemberEarningsThisMonth(uid) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  try {
    const snap = await getDocs(collection(db, 'earnings', uid, ym));
    let total = 0;
    snap.forEach(d => { total += (d.data().amount || 0); });
    return total;
  } catch {
    return 0;
  }
}

// ── Leaderboard score: weighted blend of goal completion + habit + assigned tasks ──
// Returns 0-100. Uses three sub-scores:
//   - 50% : monthly goal avg progress %
//   - 30% : 66-day habit consistency %
//   - 20% : assigned task completion %
export function computeMemberScore({ avgGoalProgress = 0, habitConsistency = 0, assignedCompletion = 0 }) {
  const a = Math.max(0, Math.min(100, avgGoalProgress));
  const b = Math.max(0, Math.min(100, habitConsistency));
  const c = Math.max(0, Math.min(100, assignedCompletion));
  return Math.round(0.5 * a + 0.3 * b + 0.2 * c);
}

// ── Build leaderboard data for a team. ──
// Returns sorted list of [{ uid, name, memberId, score, goalProgress, habitConsistency, assignedCompletion, earnings, optedOut }]
export async function getLeaderboard(teamId, leaderUid) {
  const members = await getTeamMembers(teamId);
  const allTasks = await getAssignedTasksByLeader(leaderUid);

  const rows = [];
  for (const m of members) {
    const optedOut = m.leaderboardOptOut === true;

    // Goal progress
    const summary = await getMemberProgressSummary(m.uid).catch(() => null);
    const avgGoalProgress = summary?.avgProgress ?? 0;

    // Habit consistency
    let habitConsistency = 0;
    try {
      const hSnap = await getDocs(collection(db, 'habits66', m.uid));
      hSnap.forEach(d => {
        const h = d.data();
        if (h.status === 'active') {
          const hist = h.history || [];
          if (hist.length) {
            const done = hist.filter(x => x.completed).length;
            habitConsistency = Math.round((done / hist.length) * 100);
          }
        }
      });
    } catch {}

    // Assigned task completion
    const assignedToMe = allTasks.filter(t => (t.assignedTo || []).includes(m.uid));
    let totalAssigned = 0, completedAssigned = 0;
    for (const t of assignedToMe) {
      totalAssigned += 1;
      if (t.completions?.[m.uid]?.done) completedAssigned += 1;
    }
    const assignedCompletion = totalAssigned ? Math.round((completedAssigned / totalAssigned) * 100) : 0;

    // Earnings this month
    const earnings = await getMemberEarningsThisMonth(m.uid);

    const score = computeMemberScore({ avgGoalProgress, habitConsistency, assignedCompletion });

    rows.push({
      uid: m.uid,
      name: m.name || 'Unknown',
      memberId: m.memberId,
      score,
      avgGoalProgress,
      habitConsistency,
      assignedCompletion,
      earnings,
      optedOut,
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

// ── Behind-pace detection: members whose avg progress < expected for time elapsed ──
// e.g. on day 18 of a 30-day month, expected ~60%; flag anyone < 50% of expected.
export async function getMembersBehindPace(teamId, leaderUid) {
  const members = await getTeamMembers(teamId);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedProgress = Math.round((dayOfMonth / daysInMonth) * 100);
  const threshold = Math.max(0, expectedProgress - 25); // 25 pts below pace = behind

  const behind = [];
  for (const m of members) {
    if (m.uid === leaderUid) continue;
    const summary = await getMemberProgressSummary(m.uid).catch(() => null);
    if (!summary) continue;
    if (summary.goalCount > 0 && summary.avgProgress < threshold) {
      behind.push({
        uid: m.uid, name: m.name, memberId: m.memberId,
        avgProgress: summary.avgProgress,
        expected: expectedProgress,
        gap: expectedProgress - summary.avgProgress,
      });
    }
  }
  return behind.sort((a, b) => b.gap - a.gap);
}

// ── Toggle leaderboard for a whole team (leader only) ──
export async function setTeamLeaderboardEnabled(teamId, enabled) {
  await updateDoc(doc(db, 'teams', teamId), { leaderboardEnabled: !!enabled });
}

// ── Member opt-out toggle ──
export async function setMemberLeaderboardOptOut(uid, optOut) {
  await updateDoc(doc(db, 'users', uid), { leaderboardOptOut: !!optOut });
}

// ── Aggregate fines outstanding for whole team (leader view) ──
export async function getTeamFinesSummary(teamId, leaderUid) {
  const tasks = await getAssignedTasksByLeader(leaderUid);
  const members = await getTeamMembers(teamId);
  const memberById = new Map(members.map(m => [m.uid, m]));
  const now = new Date();

  const perMember = new Map(); // uid -> { name, total, overdueCount }

  for (const t of tasks) {
    if (!t.deadline) continue;
    if (new Date(t.deadline) >= now) continue;
    for (const memberUid of t.assignedTo || []) {
      if (t.excludedFromFines?.includes(memberUid)) continue;
      const completion = t.completions?.[memberUid];
      if (completion?.done) continue;

      const cur = perMember.get(memberUid) || {
        uid: memberUid,
        name: memberById.get(memberUid)?.name || 'Unknown',
        total: 0, overdueCount: 0,
      };
      cur.total += t.fineAmount || 200;
      cur.overdueCount += 1;
      perMember.set(memberUid, cur);
    }
  }

  return Array.from(perMember.values()).sort((a, b) => b.total - a.total);
}

export async function calculateMemberFines(uid) {
  const tasks = await getAssignedTasksForUser(uid);
  let totalFine = 0;
  const overdueTasks = [];
  const now = new Date();

  for (const t of tasks) {
    if (t.excludedFromFines?.includes(uid)) continue;
    const completion = t.completions?.[uid];
    if (completion?.done) continue;

    if (t.deadline && new Date(t.deadline) < now) {
      totalFine += t.fineAmount || 200;
      overdueTasks.push({ description: t.description, fine: t.fineAmount || 200 });
    }
  }

  return { totalFine, overdueTasks };
}
