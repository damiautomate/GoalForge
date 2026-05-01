import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDocs, updateDoc, deleteDoc, collection, serverTimestamp, getDoc } from '../lib/firebase';
import { useTheme, Card, ProgressBar, Badge, Button, SectionHeader, PageTitle, pct, paceText, goalColor, TYPE_META } from '../lib/theme';
import CalibrationCard from '../components/CalibrationCard';
import GoalRollover from '../components/GoalRollover';
import GoalLibraryModal from '../components/GoalLibraryModal';
import EditGoalModal from '../components/EditGoalModal';
import { exportPlanAsPDF } from '../lib/pdfExport';

export default function GoalsPage() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showLibrary, setShowLibrary] = useState(false);
  const [editing, setEditing] = useState(null);   // full goal object being edited
  const [quickProgress, setQuickProgress] = useState(null); // goalId for quick progress edit
  const [loading, setLoading] = useState(true);
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [pastReport, setPastReport] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [showCalibration, setShowCalibration] = useState(true);
  const [showRollover, setShowRollover] = useState(true);

  const uid = auth.currentUser?.uid;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const weekNum = Math.ceil(now.getDate() / 7);

  useEffect(() => { loadGoals(); }, []);

  async function loadGoals() {
    try {
      const snap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setGoals(data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));

      const ySnap = await getDoc(doc(db, 'yearlyPlans', uid, String(now.getFullYear()), 'plan'));
      if (ySnap.exists()) setYearlyPlan(ySnap.data());

      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
      const rSnap = await getDoc(doc(db, 'monthlyReports', uid, prevYm));
      if (rSnap.exists()) setPastReport(rSnap.data());

      const wSnap = await getDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`));
      if (wSnap.exists()) setWeeklyPlan(wSnap.data());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function addGoal(goalData) {
    const id = `goal_${Date.now()}`;
    const newGoal = {
      ...goalData,
      current: goalData.current ?? 0,
      status: 'active',
      source: goalData.source || 'custom',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'monthlyGoals', uid, ym, id), newGoal);
    setGoals(prev => [...prev, { id, ...newGoal }]);
  }

  async function saveEditedGoal(updates) {
    if (!editing) return;
    await updateDoc(doc(db, 'monthlyGoals', uid, ym, editing.id), updates);
    setGoals(prev => prev.map(g => g.id === editing.id ? { ...g, ...updates } : g));
    setEditing(null);
  }

  async function deleteGoal() {
    if (!editing) return;
    await deleteDoc(doc(db, 'monthlyGoals', uid, ym, editing.id));
    setGoals(prev => prev.filter(g => g.id !== editing.id));
    setEditing(null);
  }

  async function updateProgress(goalId, newValue) {
    await updateDoc(doc(db, 'monthlyGoals', uid, ym, goalId), { current: newValue });
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, current: newValue } : g));
    setQuickProgress(null);
  }

  const filtered = filter === 'all' ? goals : goals.filter(g => g.type === filter);

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <PageTitle>{now.toLocaleString('en', { month: 'long' })} Goals</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: "6px 0 0" }}>
          {goals.filter(g => pct(g.current||0, g.target||1) >= 100).length} of {goals.length} completed · {daysLeft} days left
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all","target","measurable","habit","checklist"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 20,
            border: `1px solid ${filter===f ? t.accentBorder : t.border}`,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: filter===f ? t.accentBg : t.bgCard,
            color: filter===f ? t.accent : t.textSec, textTransform: "capitalize",
          }}>{f}</button>
        ))}
      </div>

      {showRollover && (
        <GoalRollover onComplete={() => { setShowRollover(false); loadGoals(); }}/>
      )}

      {showCalibration && goals.length >= 3 && (
        <CalibrationCard goals={goals} pastReport={pastReport} yearlyPlan={yearlyPlan}
          onDismiss={() => setShowCalibration(false)}/>
      )}

      {goals.length > 0 && (
        <button onClick={() => exportPlanAsPDF(goals, weeklyPlan, yearlyPlan, auth.currentUser?.displayName)}
          style={{
            width: "100%", padding: "11px", borderRadius: 12, marginBottom: 16,
            border: `1px solid ${t.border}`, background: t.bgCard,
            color: t.info, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: t.shadow,
          }}>📄 Export plan as PDF</button>
      )}

      <button onClick={() => setShowLibrary(true)} style={{
        width: "100%", padding: "12px", borderRadius: 14, marginBottom: 16,
        border: `1.5px dashed ${t.accentBorder}`, background: t.bgAccentSofter,
        color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>＋ Add a goal</button>

      {/* Goal list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(g => {
          const v = pct(g.current || 0, g.target || 1);
          const c = goalColor(v, t);
          const meta = TYPE_META[g.type] || TYPE_META.target;
          const isEditingProgress = quickProgress === g.id;

          return (
            <Card key={g.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <span style={{ fontSize: 24 }}>{g.icon || '🎯'}</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>{g.title}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <Badge label={meta.label} color={t[meta.colorKey]} bg={t[meta.bgKey]}/>
                      {g.category && <Badge label={g.category} color={t.textTer} bg={t.bgSurface}/>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: c, fontFamily: "'Playfair Display', serif" }}>{v}%</span>
                  <button onClick={() => setEditing(g)} title="Edit goal" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: t.textTer, fontSize: 16, padding: 4,
                  }}>✎</button>
                </div>
              </div>
              <ProgressBar value={v} color={c}/>

              {isEditingProgress ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" defaultValue={g.current || 0}
                      id={`input-${g.id}`}
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${t.accentBorder}`, background: t.inputBg,
                        color: t.text, fontSize: 16, fontWeight: 600, fontFamily: "inherit",
                      }}/>
                    <span style={{ fontSize: 13, color: t.textTer }}>/ {g.target} {g.unit}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => setQuickProgress(null)}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgCard, color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={() => {
                      const val = parseFloat(document.getElementById(`input-${g.id}`).value) || 0;
                      updateProgress(g.id, val);
                    }} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Update</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: t.textSec }}>
                    {g.type === 'checklist'
                      ? `${g.current || 0} / ${g.target} done`
                      : `${g.current || 0} / ${g.target} ${g.unit || ''}`}
                  </span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: t.textTer }}>{paceText(g.current || 0, g.target || 1, daysLeft)}</span>
                    <button onClick={() => setQuickProgress(g.id)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      borderRadius: 6, border: `1px solid ${t.accentBorder}`,
                      background: t.bgAccentSofter, color: t.accent, cursor: 'pointer', fontFamily: 'inherit',
                    }}>+ Log</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {goals.length === 0 && !loading && (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🎯</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>Set your first goal</p>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px" }}>Tap "Add a goal" — pick from the library or build a custom one.</p>
        </Card>
      )}

      {showLibrary && (
        <GoalLibraryModal onClose={() => setShowLibrary(false)} onAdd={addGoal}/>
      )}

      {editing && (
        <EditGoalModal goal={editing} onClose={() => setEditing(null)}
          onSave={saveEditedGoal} onDelete={deleteGoal}/>
      )}
    </div>
  );
}
