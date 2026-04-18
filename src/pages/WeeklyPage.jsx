import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDoc, getDocs, updateDoc, collection, serverTimestamp } from '../lib/firebase';
import { useTheme, Card, Button, Input, ProgressBar, Badge, SectionHeader, PageTitle, pct } from '../lib/theme';
import { generateWeeklyPlan, generateDailyPlan, analyzeReflection } from '../lib/ai';

function getWeekNumber(date) {
  const d = new Date(date);
  const dayOfMonth = d.getDate();
  return Math.ceil(dayOfMonth / 7);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WeeklyPage() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [dailyPlan, setDailyPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genDaily, setGenDaily] = useState(false);
  const [tab, setTab] = useState('weekly'); // weekly | daily | reflect
  const [reflection, setReflection] = useState({ whatWorked: '', whatDidnt: '', adjustment: '' });
  const [aiReflection, setAiReflection] = useState(null);
  const [reflectLoading, setReflectLoading] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [editText, setEditText] = useState('');

  const uid = auth.currentUser?.uid;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const weekNum = getWeekNumber(now);
  const daysLeft = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate();
  const dayName = DAYS[now.getDay()];

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      // Monthly goals
      const gSnap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const g = []; gSnap.forEach(d => g.push({ id: d.id, ...d.data() }));
      setGoals(g);

      // Weekly plan
      const wSnap = await getDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`));
      if (wSnap.exists()) {
        setPlan(wSnap.data());
        if (wSnap.data().reflection) setReflection(wSnap.data().reflection);
      }

      // Daily plan
      const today = now.toISOString().slice(0, 10);
      const dSnap = await getDoc(doc(db, 'dailyPlans', uid, today));
      if (dSnap.exists()) setDailyPlan(dSnap.data());

      // Yearly plan
      const ySnap = await getDoc(doc(db, 'yearlyPlans', uid, String(now.getFullYear()), 'plan'));
      if (ySnap.exists()) setYearlyPlan(ySnap.data());
    } catch (e) { console.error(e); }
  }

  async function handleGenerate() {
    if (goals.length === 0) return alert('Set some monthly goals first.');
    setGenerating(true);
    try {
      const result = await generateWeeklyPlan(goals, yearlyPlan, weekNum, daysLeft);
      const newPlan = {
        theme: result.theme,
        insight: result.insight,
        actions: (result.actions || []).map(a => ({ ...a, completed: false })),
        aiGenerated: true,
        weekNumber: weekNum,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), newPlan);
      setPlan(newPlan);
    } catch (e) {
      console.error(e);
      alert('Failed to generate plan. Check your API key in .env');
    }
    setGenerating(false);
  }

  async function handleGenerateDaily() {
    if (!plan?.actions) return;
    setGenDaily(true);
    try {
      const completedCount = plan.actions.filter(a => a.completed).length;
      const result = await generateDailyPlan(plan.actions, dayName, completedCount);
      const today = now.toISOString().slice(0, 10);
      const daily = { ...result, date: today, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'dailyPlans', uid, today), daily);
      setDailyPlan(daily);
    } catch (e) {
      console.error(e);
      alert('Failed to generate daily plan.');
    }
    setGenDaily(false);
  }

  async function toggleAction(idx) {
    const updated = { ...plan };
    updated.actions = [...plan.actions];
    updated.actions[idx] = { ...updated.actions[idx], completed: !updated.actions[idx].completed };
    await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { actions: updated.actions });
    setPlan(updated);
  }

  async function updateActionTitle(idx, newTitle) {
    const updated = { ...plan };
    updated.actions = [...plan.actions];
    updated.actions[idx] = { ...updated.actions[idx], title: newTitle };
    await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { actions: updated.actions });
    setPlan(updated);
    setEditIdx(-1);
  }

  async function removeAction(idx) {
    const updated = { ...plan };
    updated.actions = plan.actions.filter((_, i) => i !== idx);
    await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { actions: updated.actions });
    setPlan(updated);
  }

  async function addAction() {
    const updated = { ...plan };
    updated.actions = [...plan.actions, { title: 'New action item', priority: 'medium', completed: false, goalTitle: 'Custom' }];
    await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { actions: updated.actions });
    setPlan(updated);
  }

  async function saveReflection() {
    setReflectLoading(true);
    try {
      await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { reflection });
      // Get AI analysis
      const analysis = await analyzeReflection(reflection, plan, goals);
      setAiReflection(analysis);
      await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { aiReflection: analysis });
    } catch (e) {
      console.error(e);
      // Save reflection even if AI fails
      try { await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNum}`), { reflection }); } catch {}
    }
    setReflectLoading(false);
  }

  const completedActions = plan?.actions?.filter(a => a.completed).length || 0;
  const totalActions = plan?.actions?.length || 0;
  const weekProgress = totalActions ? Math.round((completedActions / totalActions) * 100) : 0;

  const priorityStyle = (p) => {
    if (p === 'high') return { color: t.danger, bg: t.dangerBg };
    if (p === 'medium') return { color: t.accent, bg: t.accentBg };
    return { color: t.textTer, bg: t.bgSurface };
  };

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label={`Week ${weekNum} · ${now.toLocaleString('en', { month: 'long' })}`} color={t.info}/>
        <PageTitle>Weekly Plan</PageTitle>
        {plan && (
          <p style={{ fontSize: 13, color: t.textSec, margin: "6px 0 0" }}>
            {completedActions}/{totalActions} actions done · Theme: <span style={{ fontWeight: 600, color: t.info }}>{plan.theme}</span>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: t.bgSurface, borderRadius: 12, padding: 3 }}>
        {[
          { k: 'weekly', l: 'Weekly' },
          { k: 'daily', l: 'Today' },
          { k: 'reflect', l: 'Reflect' },
        ].map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)} style={{
            flex: 1, padding: "10px", borderRadius: 10, border: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: tab === tb.k ? t.bgCard : "transparent",
            color: tab === tb.k ? t.text : t.textTer,
            boxShadow: tab === tb.k ? t.shadow : "none",
            transition: "all 0.2s",
          }}>{tb.l}</button>
        ))}
      </div>

      {/* ── WEEKLY TAB ── */}
      {tab === 'weekly' && (
        <>
          {!plan ? (
            <Card style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 36, margin: "0 0 12px" }}>🤖</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Generate your weekly plan</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 20px", lineHeight: 1.6 }}>
                AI will analyze your {goals.length} monthly goal{goals.length !== 1 ? 's' : ''} and create
                a focused action plan for Week {weekNum}. You can edit everything after.
              </p>
              <Button onClick={handleGenerate} disabled={generating || goals.length === 0}>
                {generating ? 'Generating...' : `Generate Week ${weekNum} Plan`}
              </Button>
              {goals.length === 0 && (
                <p style={{ fontSize: 12, color: t.danger, margin: "12px 0 0" }}>Set monthly goals first (Goals tab).</p>
              )}
            </Card>
          ) : (
            <>
              {/* AI insight */}
              {plan.insight && (
                <Card bg={t.infoBg} border="rgba(40,116,166,0.15)" style={{ marginBottom: 14, padding: "14px 18px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: t.info, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI insight</p>
                  <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.6 }}>{plan.insight}</p>
                </Card>
              )}

              {/* Progress */}
              <Card style={{ marginBottom: 14, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Week progress</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: weekProgress >= 75 ? t.success : t.accent, fontFamily: "'Playfair Display', serif" }}>{weekProgress}%</span>
                </div>
                <ProgressBar value={weekProgress} color={weekProgress >= 75 ? t.success : t.accent}/>
              </Card>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {plan.actions.map((a, i) => {
                  const ps = priorityStyle(a.priority);
                  const isEditing = editIdx === i;
                  return (
                    <Card key={i} style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {/* Checkbox */}
                        <button onClick={() => toggleAction(i)} style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                          background: a.completed ? t.success : "transparent",
                          border: `2px solid ${a.completed ? t.success : t.border}`,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                        }}>{a.completed ? "✓" : ""}</button>

                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <input value={editText} onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') updateActionTitle(i, editText); if (e.key === 'Escape') setEditIdx(-1); }}
                                autoFocus style={{
                                  flex: 1, padding: "6px 10px", borderRadius: 8,
                                  border: `1px solid ${t.accentBorder}`, background: t.inputBg,
                                  color: t.text, fontSize: 13, fontFamily: "inherit",
                                }}/>
                              <button onClick={() => updateActionTitle(i, editText)} style={{
                                padding: "6px 12px", borderRadius: 8, border: "none",
                                background: t.accent, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                              }}>Save</button>
                            </div>
                          ) : (
                            <p onClick={() => { setEditIdx(i); setEditText(a.title); }}
                              style={{
                                fontSize: 13, fontWeight: 500, color: a.completed ? t.textTer : t.text,
                                textDecoration: a.completed ? "line-through" : "none",
                                margin: 0, cursor: "pointer", lineHeight: 1.4,
                              }}>{a.title}</p>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                            <Badge label={a.priority} color={ps.color} bg={ps.bg}/>
                            {a.goalTitle && <Badge label={a.goalTitle} color={t.textTer} bg={t.bgSurface}/>}
                          </div>
                        </div>

                        {/* Remove button */}
                        <button onClick={() => removeAction(i)} style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: t.textTer, fontSize: 16, padding: "0 4px", opacity: 0.5,
                        }}>×</button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Add + Regenerate */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addAction} style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: `1.5px dashed ${t.border}`, background: t.bgCard,
                  color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>+ Add action</button>
                <button onClick={handleGenerate} disabled={generating} style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: `1px solid ${t.border}`, background: t.bgCard,
                  color: t.info, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  opacity: generating ? 0.5 : 1,
                }}>🔄 Regenerate</button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── DAILY TAB ── */}
      {tab === 'daily' && (
        <>
          <Card style={{ marginBottom: 14, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 2px" }}>{dayName}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", margin: 0 }}>
              {now.toLocaleDateString('en', { month: 'long', day: 'numeric' })}
            </p>
          </Card>

          {!dailyPlan ? (
            <Card style={{ textAlign: "center", padding: "28px 20px" }}>
              <p style={{ fontSize: 28, margin: "0 0 10px" }}>📋</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Generate today's focus</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px", lineHeight: 1.5 }}>
                AI will pick 3-5 tasks from your weekly plan based on what's left and today's day.
              </p>
              <Button onClick={handleGenerateDaily} disabled={genDaily || !plan}>
                {genDaily ? 'Generating...' : 'Plan my day'}
              </Button>
              {!plan && <p style={{ fontSize: 12, color: t.danger, margin: "10px 0 0" }}>Generate a weekly plan first.</p>}
            </Card>
          ) : (
            <>
              {dailyPlan.focusMessage && (
                <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 14, padding: "14px 18px" }}>
                  <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{dailyPlan.focusMessage}"</p>
                </Card>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(dailyPlan.tasks || []).map((task, i) => {
                  const blockColors = { morning: t.accent, afternoon: t.info, evening: t.purple };
                  const blockColor = blockColors[task.timeBlock] || t.textTer;
                  return (
                    <Card key={i} style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{
                          width: 4, height: 36, borderRadius: 2, background: blockColor,
                          flexShrink: 0, marginTop: 2,
                        }}/>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>{task.title}</p>
                          <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                            <Badge label={task.timeBlock} color={blockColor} bg={`${blockColor}15`}/>
                            {task.durationMinutes && (
                              <span style={{ fontSize: 11, color: t.textTer }}>{task.durationMinutes} min</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <button onClick={() => { setDailyPlan(null); }} style={{
                width: "100%", padding: "11px", borderRadius: 12, marginTop: 12,
                border: `1px solid ${t.border}`, background: t.bgCard,
                color: t.info, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>🔄 Regenerate today's plan</button>
            </>
          )}
        </>
      )}

      {/* ── REFLECT TAB ── */}
      {tab === 'reflect' && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>Weekly Reflection</p>
            <p style={{ fontSize: 12, color: t.textSec, margin: "0 0 16px" }}>
              5 minutes to review your week. Be honest — this data improves future AI suggestions.
            </p>

            <Input label="What worked well this week?" value={reflection.whatWorked}
              onChange={v => setReflection(r => ({...r, whatWorked: v}))}
              textarea rows={2} placeholder="What habits, actions, or decisions led to progress?"/>

            <Input label="What didn't work?" value={reflection.whatDidnt}
              onChange={v => setReflection(r => ({...r, whatDidnt: v}))}
              textarea rows={2} placeholder="Where did you fall short? What got in the way?"/>

            <Input label="One adjustment for next week" value={reflection.adjustment}
              onChange={v => setReflection(r => ({...r, adjustment: v}))}
              placeholder="What's the single most impactful change you'll make?"/>

            <Button onClick={saveReflection} disabled={reflectLoading}>
              {reflectLoading ? 'Saving & analyzing...' : 'Save reflection'}
            </Button>
          </Card>

          {(aiReflection || plan?.aiReflection) && (
            <Card bg={t.purpleBg} border={t.purpleBdr}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.purple, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>AI analysis</p>
              <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: "0 0 12px" }}>
                {(aiReflection || plan.aiReflection).insight}
              </p>
              <div style={{ background: t.bgSurface, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: t.textSec, margin: "0 0 4px" }}>Suggested adjustment</p>
                <p style={{ fontSize: 13, color: t.text, margin: 0 }}>{(aiReflection || plan.aiReflection).adjustment}</p>
              </div>
              <p style={{ fontSize: 13, color: t.success, margin: 0, fontStyle: "italic" }}>
                {(aiReflection || plan.aiReflection).encouragement}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
