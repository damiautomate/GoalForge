// Team service — handles team creation, joining, member tree, and invite codes
import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, serverTimestamp } from './firebase';
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
