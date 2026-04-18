import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDocs, updateDoc, collection, serverTimestamp, getDoc } from '../lib/firebase';
import { useTheme, Card, ProgressBar, Badge, Button, Input, SectionHeader, PageTitle, pct, paceText, goalColor, TYPE_META } from '../lib/theme';
import CalibrationCard from '../components/CalibrationCard';
import GoalRollover from '../components/GoalRollover';
import { exportPlanAsPDF } from '../lib/pdfExport';

const ICONS = ['🎯','💼','📚','👥','📱','🌐','📤','💰','🔥','📊','🏋️','✍️','🎓','🛠️','🤝'];

const PREDEFINED_GOALS = [
  { title: "Earn from freelancing", type: "target", unit: "$", category: "Freelancing", icon: "💼" },
  { title: "Complete Fiverr projects", type: "target", unit: "projects", category: "Freelancing", icon: "💼" },
  { title: "Send proposals", type: "measurable", unit: "proposals", category: "Freelancing", icon: "📤" },
  { title: "Get 5-star reviews", type: "target", unit: "reviews", category: "Freelancing", icon: "⭐" },
  { title: "Recruit team members", type: "target", unit: "people", category: "Network Marketing", icon: "👥" },
  { title: "Prospect daily", type: "habit", unit: "days", category: "Network Marketing", icon: "🤝" },
  { title: "Read a book", type: "measurable", unit: "pages", category: "Personal Dev", icon: "📚" },
  { title: "Post on social media", type: "habit", unit: "days", category: "Content", icon: "📱" },
  { title: "Listen to podcasts", type: "habit", unit: "days", category: "Personal Dev", icon: "🎧" },
  { title: "Finish portfolio website", type: "checklist", unit: "", category: "Freelancing", icon: "🌐" },
  { title: "Attend training/events", type: "target", unit: "sessions", category: "Personal Dev", icon: "🎓" },
  { title: "Learn a new skill", type: "habit", unit: "days", category: "Learning", icon: "🛠️" },
];

export default function GoalsPage() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showLib, setShowLib] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [pastReport, setPastReport] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [showCalibration, setShowCalibration] = useState(true);
  const [showRollover, setShowRollover] = useState(true);

  // New goal form
  const [form, setForm] = useState({ title: '', type: 'target', target: '', unit: '', category: '', icon: '🎯' });

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

      // Load yearly plan for calibration
      const ySnap = await getDoc(doc(db, 'yearlyPlans', uid, String(now.getFullYear()), 'plan'));
      if (ySnap.exists()) setYearlyPlan(ySnap.data());

      // Load past month report for calibration
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
      const rSnap = await getDoc(doc(db, 'monthlyReports', uid, prevYm));
      if (rSnap.exists()) setPastReport(rSnap.data());

      // Load weekly plan for PDF
      const wSnap = await getDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`));
      if (wSnap.exists()) setWeeklyPlan(wSnap.data());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function addGoal(goalData) {
    const id = `goal_${Date.now()}`;
    const newGoal = {
      ...goalData, current: 0,
      status: 'active', source: goalData.source || 'custom',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'monthlyGoals', uid, ym, id), newGoal);
    setGoals(prev => [...prev, { id, ...newGoal }]);
    setShowAdd(false); setShowLib(false);
    setForm({ title: '', type: 'target', target: '', unit: '', category: '', icon: '🎯' });
  }

  async function updateProgress(goalId, newValue) {
    await updateDoc(doc(db, 'monthlyGoals', uid, ym, goalId), { current: newValue });
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, current: newValue } : g));
    setEditGoal(null);
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

      {/* Goal Rollover from previous month */}
      {showRollover && (
        <GoalRollover onComplete={() => { setShowRollover(false); loadGoals(); }}/>
      )}

      {/* AI Calibration */}
      {showCalibration && goals.length >= 3 && (
        <CalibrationCard goals={goals} pastReport={pastReport} yearlyPlan={yearlyPlan}
          onDismiss={() => setShowCalibration(false)}/>
      )}

      {/* PDF Export */}
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

      {/* Add buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowLib(!showLib)} style={{
          flex: 1, padding: "12px", borderRadius: 14,
          border: `1.5px dashed ${t.accentBorder}`, background: t.bgAccentSofter,
          color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>📋 From library</button>
        <button onClick={() => { setShowAdd(!showAdd); setShowLib(false); }} style={{
          flex: 1, padding: "12px", borderRadius: 14,
          border: `1.5px dashed ${t.border}`, background: t.bgCard,
          color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>✏️ Custom goal</button>
      </div>

      {/* Predefined library */}
      {showLib && (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 12px" }}>Goal Library</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PREDEFINED_GOALS.map((pg, i) => (
              <div key={i} onClick={() => {
                setForm({ title: pg.title, type: pg.type, target: '', unit: pg.unit, category: pg.category, icon: pg.icon });
                setShowLib(false); setShowAdd(true);
              }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, background: t.bgSurface, cursor: "pointer",
                border: `1px solid ${t.borderLt}`,
              }}>
                <span style={{ fontSize: 18 }}>{pg.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>{pg.title}</p>
                  <p style={{ fontSize: 11, color: t.textTer, margin: "1px 0 0" }}>{pg.category} · {pg.type}</p>
                </div>
                <span style={{ fontSize: 14, color: t.accent }}>+</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add custom goal form */}
      {showAdd && (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>
            {form.title ? `Add: ${form.title}` : 'New Goal'}
          </p>
          <Input label="Goal title" value={form.title} onChange={v => setForm(f => ({...f, title: v}))} placeholder="What do you want to achieve?"/>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: "inherit" }}>
                <option value="target">Target (hit a number)</option>
                <option value="measurable">Measurable (track progress)</option>
                <option value="habit">Habit (consistency %)</option>
                <option value="checklist">Checklist (done/not done)</option>
              </select>
            </div>
            <Input label="Category" value={form.category} onChange={v => setForm(f => ({...f, category: v}))} placeholder="e.g. Freelancing"/>
          </div>
          {form.type !== 'checklist' && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Target value" value={form.target} onChange={v => setForm(f => ({...f, target: v}))} type="number" placeholder="e.g. 1700"/>
              <Input label="Unit" value={form.unit} onChange={v => setForm(f => ({...f, unit: v}))} placeholder="e.g. $, pages, days"/>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={() => addGoal({
              title: form.title, type: form.type, category: form.category,
              target: form.type === 'checklist' ? 1 : parseInt(form.target) || 0,
              unit: form.unit, icon: form.icon, source: 'custom',
            })} disabled={!form.title} style={{ flex: 2 }}>Add Goal</Button>
          </div>
        </Card>
      )}

      {/* Goal list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(g => {
          const v = pct(g.current || 0, g.target || 1);
          const c = goalColor(v, t);
          const meta = TYPE_META[g.type] || TYPE_META.target;
          const isEditing = editGoal === g.id;

          return (
            <Card key={g.id} onClick={() => !isEditing && setEditGoal(g.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <span style={{ fontSize: 24 }}>{g.icon || '🎯'}</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>{g.title}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                      <Badge label={meta.label} color={t[meta.colorKey]} bg={t[meta.bgKey]}/>
                      <Badge label={g.category} color={t.textTer} bg={t.bgSurface}/>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color: c, fontFamily: "'Playfair Display', serif" }}>{v}%</span>
              </div>
              <ProgressBar value={v} color={c}/>

              {isEditing ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" defaultValue={g.current || 0}
                      id={`input-${g.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${t.accentBorder}`, background: t.inputBg,
                        color: t.text, fontSize: 16, fontWeight: 600, fontFamily: "inherit",
                      }}/>
                    <span style={{ fontSize: 13, color: t.textTer }}>/ {g.target} {g.unit}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditGoal(null); }}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgCard, color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const val = parseInt(document.getElementById(`input-${g.id}`).value) || 0;
                      updateProgress(g.id, val);
                    }} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: t.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Update</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: t.textSec }}>
                    {g.type === 'checklist' ? (g.current ? '✓ Done' : 'Not done yet') : `${g.current || 0} / ${g.target} ${g.unit}`}
                  </span>
                  <span style={{ fontSize: 12, color: t.textTer }}>{paceText(g.current || 0, g.target || 1, daysLeft)}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {goals.length === 0 && !loading && !showAdd && !showLib && (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🎯</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>Set your first goal</p>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px" }}>Pick from the library or create a custom one above.</p>
        </Card>
      )}
    </div>
  );
}
