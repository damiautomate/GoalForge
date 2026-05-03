import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useTheme, Card, Button, Badge, SectionHeader } from '../lib/theme';
import {
  getLeaderboard, getMembersBehindPace, getTeamFinesSummary,
  setTeamLeaderboardEnabled, getAssignedTasksByLeader,
  updateAssignedTask, deleteAssignedTask,
} from '../lib/team';
import AssignTaskModal from './AssignTaskModal';
import Leaderboard from './Leaderboard';
import MemberDetailModal from './MemberDetailModal';

// Leader-specific dashboard: shown above/instead of the regular Team tab content for leaders.
// Includes: members behind pace, top earner, leaderboard toggle, fines dashboard,
// edit/delete assigned tasks, bulk-assign entry point.
export default function LeadDashboard({ team, profile, onChange }) {
  const t = useTheme();
  const uid = auth.currentUser?.uid;

  const [behind, setBehind] = useState([]);
  const [fines, setFines] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [board, setBoard] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [openMember, setOpenMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { reload(); }, [team?.id]);

  async function reload() {
    if (!team?.id) return;
    setLoading(true);
    try {
      const [b, f, t2, lb] = await Promise.all([
        getMembersBehindPace(team.id, uid),
        getTeamFinesSummary(team.id, uid),
        getAssignedTasksByLeader(uid),
        getLeaderboard(team.id, uid),
      ]);
      setBehind(b); setFines(f); setTasks(t2); setBoard(lb);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function toggleLeaderboard() {
    setBusy(true);
    try {
      await setTeamLeaderboardEnabled(team.id, !team.leaderboardEnabled);
      onChange?.();
    } catch (e) { console.error(e); }
    setBusy(false);
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task for everyone it was assigned to?')) return;
    try {
      await deleteAssignedTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) { alert('Delete failed: ' + (e.message || '')); }
  }

  async function handleSaveEdit(updates) {
    if (!editTask) return;
    try {
      await updateAssignedTask(editTask.id, updates);
      setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...updates } : t));
      setEditTask(null);
    } catch (e) { alert('Save failed: ' + (e.message || '')); }
  }

  if (loading) return (
    <Card style={{ padding: '20px', textAlign: 'center', color: t.textTer }}>Loading lead dashboard...</Card>
  );

  const topEarner = [...board].sort((a, b) => (b.earnings || 0) - (a.earnings || 0))[0];
  const totalTeamFines = fines.reduce((s, f) => s + f.total, 0);

  return (
    <div>
      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Card style={{ padding: '14px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: t.danger, fontFamily: "'Playfair Display', serif", margin: 0 }}>{behind.length}</p>
          <p style={{ fontSize: 11, color: t.textTer, margin: '4px 0 0' }}>Behind pace</p>
        </Card>
        <Card style={{ padding: '14px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: t.danger, fontFamily: "'Playfair Display', serif", margin: 0 }}>₦{totalTeamFines.toLocaleString()}</p>
          <p style={{ fontSize: 11, color: t.textTer, margin: '4px 0 0' }}>Team fines outstanding</p>
        </Card>
      </div>

      {/* Top earner */}
      {topEarner && topEarner.earnings > 0 && (
        <Card bg={t.successBg} border={t.successBdr} style={{ marginBottom: 14 }}>
          <SectionHeader label="Top earner this month" color={t.success}/>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: '6px 0 2px' }}>
            🏆 {topEarner.name}
          </p>
          <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>${(topEarner.earnings || 0).toLocaleString()} logged this month</p>
        </Card>
      )}

      {/* Behind pace alerts */}
      {behind.length > 0 && (
        <Card bg={t.dangerBg} border="rgba(192,57,43,0.2)" style={{ marginBottom: 14 }}>
          <SectionHeader label="Members falling behind" color={t.danger}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {behind.slice(0, 5).map(m => (
              <div key={m.uid} onClick={() => setOpenMember(m)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: t.bgCard, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>{m.name}</p>
                  <p style={{ fontSize: 11, color: t.textTer, margin: '1px 0 0' }}>
                    {m.avgProgress}% (expected {m.expected}%) · {m.gap} pts behind
                  </p>
                </div>
                <Badge label="Open ›" color={t.danger} bg={t.dangerBg}/>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fines dashboard */}
      {fines.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <SectionHeader label="Outstanding fines" color={t.danger}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {fines.map(f => (
              <div key={f.uid} onClick={() => setOpenMember({ uid: f.uid, name: f.name })} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8, background: t.bgSurface, cursor: 'pointer',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: t.textTer, margin: '1px 0 0' }}>{f.overdueCount} overdue · tap for details</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.danger }}>₦{f.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Leaderboard toggle */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Leaderboard</p>
            <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>
              {team.leaderboardEnabled ? 'Visible to all members' : 'Off — only you see ranks'}
            </p>
          </div>
          <button onClick={toggleLeaderboard} disabled={busy} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            <div style={{
              width: 48, height: 26, borderRadius: 13,
              background: team.leaderboardEnabled ? t.success : t.bgSurface,
              border: `1px solid ${t.border}`, position: 'relative', transition: 'all 0.3s',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2, left: team.leaderboardEnabled ? 25 : 2,
                transition: 'left 0.3s',
              }}/>
            </div>
          </button>
        </div>
      </Card>

      {/* Leaderboard preview always visible to leader, even if disabled for the team */}
      {board.length > 0 && (
        <Leaderboard teamId={team.id} leaderUid={uid}
          enabled={true} showTop={10} currentUserUid={uid}
          onMemberClick={(row) => setOpenMember({ uid: row.uid, name: row.name, memberId: row.memberId })}/>
      )}

      {/* Assigned tasks management */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Assigned tasks ({tasks.length})</p>
        <Button onClick={() => setShowAssign(true)} style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}>+ Assign</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => {
          const completedCount = Object.values(task.completions || {}).filter(c => c.done).length;
          const totalAssigned = task.assignedTo?.length || 0;
          const overdue = task.deadline && new Date(task.deadline) < new Date();
          return (
            <Card key={task.id} bg={overdue ? t.dangerBg : t.bgCard} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0, flex: 1, lineHeight: 1.4 }}>
                  {task.description}
                </p>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditTask(task)} style={{
                    background: 'none', border: 'none', color: t.textSec, cursor: 'pointer', fontSize: 14,
                  }}>✎</button>
                  <button onClick={() => handleDeleteTask(task.id)} style={{
                    background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: 14,
                  }}>×</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                <Badge label={task.type === 'recurring' ? 'Recurring' : 'One-time'} color={t.info} bg={t.infoBg}/>
                {task.deadline && (
                  <Badge label={`Due ${new Date(task.deadline).toLocaleDateString()}`}
                    color={overdue ? t.danger : t.textSec}
                    bg={overdue ? t.dangerBg : t.bgSurface}/>
                )}
                {task.fineAmount > 0 && <Badge label={`₦${task.fineAmount}`} color={t.danger} bg={t.dangerBg}/>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: t.textSec }}>
                <span>{completedCount}/{totalAssigned} completed</span>
                <span>scope: {task.scope}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {showAssign && (
        <AssignTaskModal teamId={team.id} onClose={() => setShowAssign(false)} onCreated={reload}/>
      )}

      {editTask && (
        <EditTaskModal task={editTask} onClose={() => setEditTask(null)} onSave={handleSaveEdit}/>
      )}

      {openMember && (
        <MemberDetailModal member={openMember} onClose={() => setOpenMember(null)}/>
      )}
    </div>
  );
}

// Inline simple modal for editing an existing assigned task.
function EditTaskModal({ task, onClose, onSave }) {
  const t = useTheme();
  const [form, setForm] = useState({
    description: task.description || '',
    deadline: task.deadline || '',
    fineAmount: task.fineAmount || 0,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        description: form.description,
        deadline: form.deadline || null,
        fineAmount: parseInt(form.fineAmount) || 0,
      });
    } catch {}
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, width: '100%', maxWidth: 480,
        borderRadius: '20px 20px 0 0', padding: '20px 20px 28px',
      }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: t.text, margin: '0 0 14px' }}>
          Edit task
        </h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Deadline</label>
          <input type="date" value={form.deadline ? form.deadline.slice(0, 10) : ''} onChange={e => setForm(f => ({...f, deadline: e.target.value}))}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Fine (₦)</label>
          <input type="number" value={form.fineAmount} onChange={e => setForm(f => ({...f, fineAmount: e.target.value}))}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
