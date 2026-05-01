import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDoc, getDocs, updateDoc, collection, serverTimestamp } from '../lib/firebase';
import { useTheme, Card, Button, Input, ProgressBar, Badge, SectionHeader, PageTitle } from '../lib/theme';
import { generateMonthlyPlan, regenerateSingleWeek, generateDailyPlan, analyzeReflection } from '../lib/ai';
import WeeklyActionEditor from '../components/WeeklyActionEditor';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekNumber(date) {
  return Math.ceil(date.getDate() / 7);
}

function getTotalWeeks(year, monthIdx) {
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  return Math.ceil(daysInMonth / 7);
}

export default function WeeklyPage() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [weeks, setWeeks] = useState([]); // [{ weekNumber, theme, insight, actions, reflection?, aiReflection? }, ...]
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [dailyPlan, setDailyPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [regenWeek, setRegenWeek] = useState(0); // 0 = none, otherwise weekNumber being regenerated
  const [genDaily, setGenDaily] = useState(false);
  const [tab, setTab] = useState('weekly'); // weekly | daily | reflect
  const [openWeek, setOpenWeek] = useState(0); // current open accordion week
  const [editingAction, setEditingAction] = useState(null); // { weekIdx, actionIdx, action }
  const [reflection, setReflection] = useState({ whatWorked: '', whatDidnt: '', adjustment: '' });
  const [aiReflection, setAiReflection] = useState(null);
  const [reflectLoading, setReflectLoading] = useState(false);

  const uid = auth.currentUser?.uid;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const currentWeek = getWeekNumber(now);
  const totalWeeks = getTotalWeeks(now.getFullYear(), now.getMonth());
  const dayName = DAYS[now.getDay()];

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setOpenWeek(currentWeek); }, []); // open current week by default

  async function loadData() {
    try {
      const gSnap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const g = []; gSnap.forEach(d => g.push({ id: d.id, ...d.data() }));
      setGoals(g);

      // Load all weekly plan docs for the month
      const loaded = [];
      for (let w = 1; w <= totalWeeks; w++) {
        const wSnap = await getDoc(doc(db, 'weeklyPlans', uid, ym, `week${w}`));
        if (wSnap.exists()) loaded.push({ weekNumber: w, ...wSnap.data() });
      }
      setWeeks(loaded);

      // Load reflection for current week if present
      const cw = loaded.find(w => w.weekNumber === currentWeek);
      if (cw?.reflection) setReflection(cw.reflection);
      if (cw?.aiReflection) setAiReflection(cw.aiReflection);

      // Daily plan
      const today = now.toISOString().slice(0, 10);
      const dSnap = await getDoc(doc(db, 'dailyPlans', uid, today));
      if (dSnap.exists()) setDailyPlan(dSnap.data());

      const ySnap = await getDoc(doc(db, 'yearlyPlans', uid, String(now.getFullYear()), 'plan'));
      if (ySnap.exists()) setYearlyPlan(ySnap.data());
    } catch (e) { console.error(e); }
  }

  async function handleGenerateMonth() {
    if (goals.length === 0) return alert('Set some monthly goals first.');
    setGenerating(true);
    try {
      const result = await generateMonthlyPlan(goals, yearlyPlan, totalWeeks, []);
      const generatedWeeks = (result.weeks || []).map(w => ({
        weekNumber: w.weekNumber,
        theme: w.theme,
        insight: w.insight,
        actions: (w.actions || []).map(a => ({ ...a, completed: false })),
        aiGenerated: true,
        createdAt: serverTimestamp(),
      }));
      // Persist each week
      for (const w of generatedWeeks) {
        await setDoc(doc(db, 'weeklyPlans', uid, ym, `week${w.weekNumber}`), w);
      }
      setWeeks(generatedWeeks);
      setOpenWeek(currentWeek);
    } catch (e) {
      console.error(e);
      alert('Failed to generate monthly plan: ' + (e.message || ''));
    }
    setGenerating(false);
  }

  async function handleRegenerateWeek(weekNumber) {
    setRegenWeek(weekNumber);
    try {
      const priorWeeks = weeks.filter(w => w.weekNumber < weekNumber);
      const result = await regenerateSingleWeek(goals, yearlyPlan, weekNumber, totalWeeks, priorWeeks);
      const updated = {
        weekNumber,
        theme: result.theme,
        insight: result.insight,
        actions: (result.actions || []).map(a => ({ ...a, completed: false })),
        aiGenerated: true,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNumber}`), updated);
      setWeeks(prev => {
        const next = prev.filter(w => w.weekNumber !== weekNumber);
        next.push(updated);
        return next.sort((a, b) => a.weekNumber - b.weekNumber);
      });
    } catch (e) {
      console.error(e);
      alert('Failed to regenerate week: ' + (e.message || ''));
    }
    setRegenWeek(0);
  }

  async function persistWeek(weekNumber, weekData) {
    await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${weekNumber}`), weekData);
  }

  async function toggleAction(weekNumber, actionIdx) {
    setWeeks(prev => prev.map(w => {
      if (w.weekNumber !== weekNumber) return w;
      const actions = [...(w.actions || [])];
      actions[actionIdx] = { ...actions[actionIdx], completed: !actions[actionIdx].completed };
      persistWeek(weekNumber, { actions });
      return { ...w, actions };
    }));
  }

  async function saveActionEdit(updatedAction) {
    if (!editingAction) return;
    const { weekNumber, actionIdx } = editingAction;
    setWeeks(prev => prev.map(w => {
      if (w.weekNumber !== weekNumber) return w;
      const actions = [...(w.actions || [])];
      actions[actionIdx] = { ...actions[actionIdx], ...updatedAction };
      persistWeek(weekNumber, { actions });
      return { ...w, actions };
    }));
    setEditingAction(null);
  }

  async function deleteAction() {
    if (!editingAction) return;
    const { weekNumber, actionIdx } = editingAction;
    setWeeks(prev => prev.map(w => {
      if (w.weekNumber !== weekNumber) return w;
      const actions = (w.actions || []).filter((_, i) => i !== actionIdx);
      persistWeek(weekNumber, { actions });
      return { ...w, actions };
    }));
    setEditingAction(null);
  }

  async function addAction(weekNumber) {
    const newAction = {
      title: 'New action item', priority: 'medium', completed: false,
      goalId: '', goalTitle: '', day: null, timeBlock: null,
    };
    setWeeks(prev => prev.map(w => {
      if (w.weekNumber !== weekNumber) return w;
      const actions = [...(w.actions || []), newAction];
      persistWeek(weekNumber, { actions });
      return { ...w, actions };
    }));
  }

  async function handleGenerateDaily() {
    const cw = weeks.find(w => w.weekNumber === currentWeek);
    if (!cw?.actions) return;
    setGenDaily(true);
    try {
      const completedCount = cw.actions.filter(a => a.completed).length;
      const result = await generateDailyPlan(cw.actions, dayName, completedCount);
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

  async function saveReflection() {
    setReflectLoading(true);
    try {
      const cw = weeks.find(w => w.weekNumber === currentWeek);
      await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${currentWeek}`), { reflection });
      const analysis = await analyzeReflection(reflection, cw, goals);
      setAiReflection(analysis);
      await updateDoc(doc(db, 'weeklyPlans', uid, ym, `week${currentWeek}`), { aiReflection: analysis });
    } catch (e) {
      console.error(e);
    }
    setReflectLoading(false);
  }

  const priorityStyle = (p) => {
    if (p === 'high') return { color: t.danger, bg: t.dangerBg };
    if (p === 'medium') return { color: t.accent, bg: t.accentBg };
    return { color: t.textTer, bg: t.bgSurface };
  };

  const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const allWeeksMissing = sortedWeeks.length === 0;

  const currentWeekData = weeks.find(w => w.weekNumber === currentWeek);

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label={`${now.toLocaleString('en', { month: 'long' })} · ${totalWeeks} weeks`} color={t.info}/>
        <PageTitle>Monthly Plan</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: "6px 0 0" }}>
          Currently in Week {currentWeek}. Tap any week to expand, edit actions, or regenerate.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: t.bgSurface, borderRadius: 12, padding: 3 }}>
        {[
          { k: 'weekly', l: 'Weeks' },
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
          {allWeeksMissing ? (
            <Card style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 36, margin: "0 0 12px" }}>🤖</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Generate the whole month</p>
              <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 20px", lineHeight: 1.6 }}>
                AI will break your {goals.length} monthly goal{goals.length !== 1 ? 's' : ''} into all {totalWeeks} weeks of {now.toLocaleString('en', { month: 'long' })} — themes, insights, and actions.
              </p>
              <Button onClick={handleGenerateMonth} disabled={generating || goals.length === 0}>
                {generating ? 'Generating...' : `Generate ${totalWeeks}-week plan`}
              </Button>
              {goals.length === 0 && (
                <p style={{ fontSize: 12, color: t.danger, margin: "12px 0 0" }}>Set monthly goals first (Goals tab).</p>
              )}
            </Card>
          ) : (
            <>
              {/* Week accordion */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(weekNumber => {
                  const w = sortedWeeks.find(x => x.weekNumber === weekNumber);
                  const isOpen = openWeek === weekNumber;
                  const isCurrent = weekNumber === currentWeek;
                  const total = w?.actions?.length || 0;
                  const done = w?.actions?.filter(a => a.completed).length || 0;
                  const wPct = total ? Math.round((done / total) * 100) : 0;

                  return (
                    <Card key={weekNumber} style={{ padding: '14px 16px' }}>
                      <div onClick={() => setOpenWeek(isOpen ? 0 : weekNumber)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isCurrent ? t.accent : t.bgSurface,
                          color: isCurrent ? '#fff' : t.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontFamily: "'Playfair Display', serif",
                        }}>{weekNumber}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>
                            Week {weekNumber}{w?.theme ? ` — ${w.theme}` : ''}
                            {isCurrent && <span style={{ fontSize: 9, marginLeft: 6, color: t.accent, fontWeight: 700 }}>NOW</span>}
                          </p>
                          {w ? (
                            <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>
                              {done}/{total} actions · {wPct}%
                            </p>
                          ) : (
                            <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>Not generated yet</p>
                          )}
                        </div>
                        <span style={{ fontSize: 16, color: t.textTer }}>{isOpen ? '▾' : '▸'}</span>
                      </div>

                      {/* Body */}
                      {isOpen && (
                        <div style={{ marginTop: 12 }}>
                          {!w ? (
                            <Button onClick={() => handleRegenerateWeek(weekNumber)} disabled={regenWeek === weekNumber}>
                              {regenWeek === weekNumber ? 'Generating...' : `Generate Week ${weekNumber}`}
                            </Button>
                          ) : (
                            <>
                              {w.insight && (
                                <Card bg={t.infoBg} border="rgba(40,116,166,0.15)" style={{ marginBottom: 10, padding: '10px 14px' }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: t.info, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI insight</p>
                                  <p style={{ fontSize: 12, color: t.text, margin: 0, lineHeight: 1.55 }}>{w.insight}</p>
                                </Card>
                              )}

                              <ProgressBar value={wPct} color={wPct >= 75 ? t.success : t.accent}/>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                                {(w.actions || []).map((a, i) => {
                                  const ps = priorityStyle(a.priority);
                                  return (
                                    <div key={i} style={{
                                      display: 'flex', alignItems: 'flex-start', gap: 10,
                                      padding: '10px 12px', borderRadius: 10,
                                      background: t.bgSurface, border: `1px solid ${t.borderLt}`,
                                    }}>
                                      <button onClick={() => toggleAction(weekNumber, i)} style={{
                                        width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                                        background: a.completed ? t.success : 'transparent',
                                        border: `2px solid ${a.completed ? t.success : t.border}`,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontSize: 12, fontWeight: 700,
                                      }}>{a.completed ? '✓' : ''}</button>
                                      <div style={{ flex: 1 }}>
                                        <p style={{
                                          fontSize: 13, fontWeight: 500, margin: 0,
                                          color: a.completed ? t.textTer : t.text,
                                          textDecoration: a.completed ? 'line-through' : 'none',
                                          lineHeight: 1.4,
                                        }}>{a.title}</p>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                          <Badge label={a.priority || 'medium'} color={ps.color} bg={ps.bg}/>
                                          {a.day && <Badge label={a.day} color={t.purple} bg={t.purpleBg}/>}
                                          {a.timeBlock && <Badge label={a.timeBlock} color={t.info} bg={t.infoBg}/>}
                                          {a.goalTitle && <Badge label={a.goalTitle} color={t.textTer} bg={t.bgCard}/>}
                                        </div>
                                      </div>
                                      <button onClick={() => setEditingAction({ weekNumber, actionIdx: i, action: a })} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: t.textTer, fontSize: 14, padding: '0 4px',
                                      }}>✎</button>
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button onClick={() => addAction(weekNumber)} style={{
                                  flex: 1, padding: '10px', borderRadius: 10,
                                  border: `1.5px dashed ${t.border}`, background: t.bgCard,
                                  color: t.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                }}>+ Add</button>
                                <button onClick={() => handleRegenerateWeek(weekNumber)} disabled={regenWeek === weekNumber} style={{
                                  flex: 1, padding: '10px', borderRadius: 10,
                                  border: `1px solid ${t.border}`, background: t.bgCard,
                                  color: t.info, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                  opacity: regenWeek === weekNumber ? 0.5 : 1,
                                }}>{regenWeek === weekNumber ? 'Regenerating...' : '🔄 Regenerate'}</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              <button onClick={handleGenerateMonth} disabled={generating} style={{
                width: '100%', padding: '11px', borderRadius: 12,
                border: `1px solid ${t.border}`, background: t.bgCard,
                color: t.danger, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>{generating ? 'Regenerating month...' : '⚠ Regenerate the entire month'}</button>
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
                AI picks 3-5 tasks from this week's actions for today.
              </p>
              <Button onClick={handleGenerateDaily} disabled={genDaily || !currentWeekData}>
                {genDaily ? 'Generating...' : 'Plan my day'}
              </Button>
              {!currentWeekData && <p style={{ fontSize: 12, color: t.danger, margin: "10px 0 0" }}>Generate the weekly plan first.</p>}
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
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>Week {currentWeek} reflection</p>
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

            <Button onClick={saveReflection} disabled={reflectLoading || !currentWeekData}>
              {reflectLoading ? 'Saving & analyzing...' : 'Save reflection'}
            </Button>
          </Card>

          {aiReflection && (
            <Card bg={t.purpleBg} border={t.purpleBdr}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.purple, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>AI analysis</p>
              <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: "0 0 12px" }}>{aiReflection.insight}</p>
              <div style={{ background: t.bgSurface, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: t.textSec, margin: "0 0 4px" }}>Suggested adjustment</p>
                <p style={{ fontSize: 13, color: t.text, margin: 0 }}>{aiReflection.adjustment}</p>
              </div>
              <p style={{ fontSize: 13, color: t.success, margin: 0, fontStyle: "italic" }}>{aiReflection.encouragement}</p>
            </Card>
          )}
        </>
      )}

      {editingAction && (
        <WeeklyActionEditor
          action={editingAction.action}
          goals={goals}
          onClose={() => setEditingAction(null)}
          onSave={saveActionEdit}
          onDelete={deleteAction}
        />
      )}
    </div>
  );
}
