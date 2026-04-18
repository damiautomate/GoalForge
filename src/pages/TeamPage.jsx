import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, updateDoc } from '../lib/firebase';
import { useTheme, Card, Button, Input, ProgressBar, Badge, SectionHeader, PageTitle, pct } from '../lib/theme';
import {
  createTeam, joinTeamByCode, joinTeamByMemberId, getTeam,
  getDownlineTree, getTeamMembers, getMemberProgressSummary,
  getAssignedTasksForUser, getAssignedTasksByLeader,
  completeAssignedTask, calculateMemberFines,
} from '../lib/team';
import AssignTaskModal from '../components/AssignTaskModal';

export default function TeamPage() {
  const t = useTheme();
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | tasks | members
  const [downlineTree, setDownlineTree] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [memberStats, setMemberStats] = useState({});
  const [myFines, setMyFines] = useState({ totalFine: 0, overdueTasks: [] });
  const [loading, setLoading] = useState(true);

  // Setup mode
  const [showSetup, setShowSetup] = useState(false);
  const [setupMode, setSetupMode] = useState('join'); // create | join
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [memberId, setMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState('');

  const uid = auth.currentUser?.uid;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data();
      setProfile(userData);

      if (userData?.teamId) {
        const t = await getTeam(userData.teamId);
        setTeam(t);

        const isLeader = userData.teamRole === 'leader' || userData.uid === t?.leaderId;

        // Load assigned tasks
        if (isLeader) {
          const tasks = await getAssignedTasksByLeader(uid);
          setAssignedTasks(tasks);
        } else {
          const tasks = await getAssignedTasksForUser(uid);
          setAssignedTasks(tasks);
        }

        // Load downline tree
        const tree = await getDownlineTree(uid);
        setDownlineTree(tree);

        // Load my fines
        const fines = await calculateMemberFines(uid);
        setMyFines(fines);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadMemberStats(memberUid) {
    if (memberStats[memberUid]) return;
    try {
      const stats = await getMemberProgressSummary(memberUid);
      setMemberStats(prev => ({ ...prev, [memberUid]: stats }));
    } catch (e) { console.error(e); }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setSubmitting(true); setSetupError('');
    try {
      await createTeam({
        name: teamName.trim(),
        leaderUid: uid,
        leaderName: auth.currentUser.displayName,
      });
      setShowSetup(false);
      await loadData();
    } catch (e) { setSetupError(e.message); }
    setSubmitting(false);
  }

  async function handleJoinByCode() {
    if (!inviteCode.trim()) return;
    setSubmitting(true); setSetupError('');
    try {
      await joinTeamByCode({
        inviteCode: inviteCode.trim(),
        userUid: uid,
        userName: auth.currentUser.displayName,
        uplineMemberId: memberId.trim() || null,
      });
      setShowSetup(false);
      await loadData();
    } catch (e) { setSetupError(e.message); }
    setSubmitting(false);
  }

  async function handleJoinByMemberId() {
    if (!memberId.trim()) return;
    setSubmitting(true); setSetupError('');
    try {
      await joinTeamByMemberId({
        memberId: memberId.trim(),
        userUid: uid,
        userName: auth.currentUser.displayName,
      });
      setShowSetup(false);
      await loadData();
    } catch (e) { setSetupError(e.message); }
    setSubmitting(false);
  }

  async function markTaskDone(taskId, proof = '') {
    try {
      await completeAssignedTask({ taskId, uid, proof });
      await loadData();
    } catch (e) { alert(e.message); }
  }

  function copyInvite() {
    if (!team) return;
    const link = `${window.location.origin}?invite=${team.inviteCode}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied!');
  }

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: t.textTer }}>Loading...</div>;

  // ── No team yet ──
  if (!profile?.teamId) {
    return (
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ padding: "28px 0 22px" }}>
          <SectionHeader label="Team Accountability" color={t.purple}/>
          <PageTitle>Build Your Team</PageTitle>
          <p style={{ fontSize: 13, color: t.textSec, margin: "8px 0 0", lineHeight: 1.6 }}>
            Lead a team of accountability partners or join an existing one. Get assigned tasks, track downline progress, and grow together.
          </p>
        </div>

        {!showSetup ? (
          <>
            <Card bg={t.purpleBg} border={t.purpleBdr} style={{ marginBottom: 12, textAlign: "center", padding: "28px 20px" }}>
              <p style={{ fontSize: 36, margin: "0 0 12px" }}>👑</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Create a Team</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px", lineHeight: 1.5 }}>
                You'll become the team leader. Invite members via code, link, or member ID.
              </p>
              <Button onClick={() => { setSetupMode('create'); setShowSetup(true); }}>Create Team</Button>
            </Card>

            <Card style={{ textAlign: "center", padding: "28px 20px" }}>
              <p style={{ fontSize: 36, margin: "0 0 12px" }}>🤝</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Join a Team</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px", lineHeight: 1.5 }}>
                Got an invite code or member ID from your upline? Use it to join their team.
              </p>
              <Button variant="secondary" onClick={() => { setSetupMode('join'); setShowSetup(true); }}>Join Team</Button>
            </Card>
          </>
        ) : (
          <Card>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: t.bgSurface, borderRadius: 10, padding: 3 }}>
              {[
                { k: 'create', l: 'Create' },
                { k: 'join', l: 'Join' },
              ].map(m => (
                <button key={m.k} onClick={() => setSetupMode(m.k)} style={{
                  flex: 1, padding: "9px", borderRadius: 8, border: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  background: setupMode === m.k ? t.bgCard : "transparent",
                  color: setupMode === m.k ? t.text : t.textTer,
                }}>{m.l}</button>
              ))}
            </div>

            {setupMode === 'create' ? (
              <>
                <Input label="Team name" value={teamName} onChange={setTeamName} placeholder="e.g. Elivate Network"/>
                <Button onClick={handleCreateTeam} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create team & become leader'}
                </Button>
              </>
            ) : (
              <>
                <Input label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="e.g. ELIV2026-A1B2C"/>
                <p style={{ fontSize: 12, color: t.textTer, margin: "-8px 0 12px" }}>OR</p>
                <Input label="Upline's Member ID" value={memberId} onChange={setMemberId} placeholder="e.g. ELV-XYZ123"/>
                {setupError && (
                  <p style={{ fontSize: 13, color: t.danger, margin: "0 0 12px" }}>{setupError}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {inviteCode && (
                    <Button onClick={handleJoinByCode} disabled={submitting} style={{ flex: 1 }}>Join by code</Button>
                  )}
                  {memberId && !inviteCode && (
                    <Button onClick={handleJoinByMemberId} disabled={submitting} style={{ flex: 1 }}>Join by Member ID</Button>
                  )}
                </div>
              </>
            )}

            <button onClick={() => setShowSetup(false)} style={{
              width: "100%", padding: "10px", marginTop: 12,
              background: "none", border: "none", color: t.textTer,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>Cancel</button>
          </Card>
        )}
      </div>
    );
  }

  // ── Has team ──
  const isLeader = profile.teamRole === 'leader';
  const directDownlineCount = downlineTree.length;

  function renderMemberNode(member, depth = 0) {
    const stats = memberStats[member.uid];
    return (
      <div key={member.uid}>
        <div onClick={() => loadMemberStats(member.uid)} style={{
          marginLeft: depth * 12,
          padding: "12px 14px", borderRadius: 10,
          background: t.bgCard, border: `1px solid ${t.border}`,
          marginBottom: 6, cursor: "pointer",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>
                {member.name || 'Unknown'}
                {depth === 0 && <span style={{ fontSize: 9, marginLeft: 6, color: t.accent, fontWeight: 700 }}>DIRECT</span>}
              </p>
              <p style={{ fontSize: 11, color: t.textTer, margin: "2px 0 0" }}>
                {member.memberId} · Joined {member.joinedTeamAt?.toDate?.()?.toLocaleDateString() || '—'}
              </p>
            </div>
            {stats && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display', serif", margin: 0 }}>
                  {stats.avgProgress}%
                </p>
                <p style={{ fontSize: 10, color: t.textTer, margin: 0 }}>
                  {stats.completedGoals}/{stats.goalCount} goals
                </p>
              </div>
            )}
          </div>
          {stats && (
            <div style={{ marginTop: 8, display: "flex", gap: 10, fontSize: 11, color: t.textSec }}>
              {stats.habitDay > 0 && <span>🔥 Day {stats.habitDay}/{stats.habitTotal}</span>}
              <span>📅 Today: {stats.todayProgress}%</span>
            </div>
          )}
        </div>
        {member.downline?.length > 0 && member.downline.map(child => renderMemberNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 18px" }}>
        <SectionHeader label={isLeader ? "Team Leader" : "Team Member"} color={t.purple}/>
        <PageTitle>{team?.name}</PageTitle>
        <p style={{ fontSize: 13, color: t.textTer, margin: "6px 0 0" }}>
          {team?.memberCount} member{team?.memberCount !== 1 ? 's' : ''} · Your ID: <span style={{ color: t.purple, fontWeight: 600 }}>{profile.memberId}</span>
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: t.bgSurface, borderRadius: 10, padding: 3 }}>
        {[
          { k: 'overview', l: 'Overview' },
          { k: 'tasks', l: `Tasks${assignedTasks.length ? ` (${assignedTasks.length})` : ''}` },
          { k: 'members', l: `Tree${directDownlineCount ? ` (${directDownlineCount})` : ''}` },
        ].map(s => (
          <button key={s.k} onClick={() => setTab(s.k)} style={{
            flex: 1, padding: "9px", borderRadius: 8, border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: tab === s.k ? t.bgCard : "transparent",
            color: tab === s.k ? t.text : t.textTer,
            boxShadow: tab === s.k ? t.shadow : "none",
          }}>{s.l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <>
          {/* Invite section */}
          {isLeader && (
            <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.accent, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Invite to your team</p>
              <div style={{ background: t.bgCard, borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: t.textTer, margin: "0 0 2px" }}>Invite code</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: t.accent, margin: 0, fontFamily: "monospace" }}>{team.inviteCode}</p>
              </div>
              <Button onClick={copyInvite} variant="secondary">📋 Copy invite link</Button>
            </Card>
          )}

          {/* My fines */}
          {myFines.totalFine > 0 && (
            <Card bg={t.dangerBg} border="rgba(192,57,43,0.2)" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: t.danger, margin: "0 0 6px" }}>
                💸 Outstanding fines: ₦{myFines.totalFine.toLocaleString()}
              </p>
              <p style={{ fontSize: 12, color: t.text, margin: 0 }}>
                {myFines.overdueTasks.length} overdue task{myFines.overdueTasks.length !== 1 ? 's' : ''}. Complete them to stop the bleeding.
              </p>
            </Card>
          )}

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Card style={{ padding: "14px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: t.purple, fontFamily: "'Playfair Display', serif", margin: 0 }}>{directDownlineCount}</p>
              <p style={{ fontSize: 11, color: t.textTer, margin: "4px 0 0" }}>Direct downline</p>
            </Card>
            <Card style={{ padding: "14px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif", margin: 0 }}>{assignedTasks.filter(t => !t.completions?.[uid]?.done).length}</p>
              <p style={{ fontSize: 11, color: t.textTer, margin: "4px 0 0" }}>Pending tasks</p>
            </Card>
          </div>

          {/* Leader actions */}
          {isLeader && (
            <Button onClick={() => setShowAssign(true)} style={{ marginBottom: 12 }}>
              ➕ Assign new task
            </Button>
          )}
        </>
      )}

      {/* TASKS */}
      {tab === 'tasks' && (
        <>
          {isLeader && (
            <Button onClick={() => setShowAssign(true)} style={{ marginBottom: 14 }}>
              ➕ Assign new task
            </Button>
          )}

          {assignedTasks.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>
                {isLeader ? 'No tasks assigned yet' : 'No tasks for you'}
              </p>
              <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
                {isLeader ? 'Create your first team task to get started.' : 'Your leader hasn\'t assigned anything yet.'}
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {assignedTasks.map(task => {
                const myCompletion = task.completions?.[uid];
                const isDone = myCompletion?.done;
                const completedCount = Object.values(task.completions || {}).filter(c => c.done).length;
                const totalAssigned = task.assignedTo?.length || 0;
                const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !isDone;

                return (
                  <Card key={task.id} bg={isDone ? t.successBg : isOverdue ? t.dangerBg : t.bgCard}
                    border={isDone ? t.successBdr : isOverdue ? "rgba(192,57,43,0.2)" : t.border}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0, flex: 1, lineHeight: 1.4 }}>
                        {task.description}
                      </p>
                      {isDone && <span style={{ fontSize: 18, marginLeft: 8 }}>✓</span>}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <Badge label={task.type === 'recurring' ? 'Recurring' : 'One-time'} color={t.info} bg={t.infoBg}/>
                      {task.deadline && (
                        <Badge label={`Due ${new Date(task.deadline).toLocaleDateString()}`}
                          color={isOverdue ? t.danger : t.textSec}
                          bg={isOverdue ? t.dangerBg : t.bgSurface}/>
                      )}
                      {task.fineAmount > 0 && (
                        <Badge label={`Fine ₦${task.fineAmount}`} color={t.danger} bg={t.dangerBg}/>
                      )}
                      {task.proofRequired && (
                        <Badge label="Proof required" color={t.purple} bg={t.purpleBg}/>
                      )}
                    </div>

                    {isLeader ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${t.borderLt}` }}>
                        <span style={{ fontSize: 12, color: t.textSec }}>
                          {completedCount}/{totalAssigned} completed
                        </span>
                        <ProgressBar value={(completedCount/totalAssigned)*100} height={4} color={t.success}/>
                      </div>
                    ) : (
                      !isDone && (
                        <button onClick={() => markTaskDone(task.id)} style={{
                          width: "100%", padding: "10px", borderRadius: 10, border: "none",
                          background: t.success, color: "#fff", fontSize: 13, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit", marginTop: 4,
                        }}>✓ Mark as done</button>
                      )
                    )}

                    <p style={{ fontSize: 11, color: t.textTer, margin: "8px 0 0" }}>
                      Assigned by {task.assignedByName || 'Leader'}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <>
          {downlineTree.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>🌱</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>No downline yet</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
                {isLeader ? 'Share your invite code to start building your team.' : 'You haven\'t recruited anyone yet.'}
              </p>
            </Card>
          ) : (
            <>
              <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 10px" }}>Tap a member to load their stats</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {downlineTree.map(m => renderMemberNode(m))}
              </div>
            </>
          )}
        </>
      )}

      {/* Assign task modal */}
      {showAssign && (
        <AssignTaskModal teamId={profile.teamId} onClose={() => setShowAssign(false)} onCreated={loadData}/>
      )}
    </div>
  );
}
