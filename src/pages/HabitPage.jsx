import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDocs, updateDoc, collection, serverTimestamp } from '../lib/firebase';
import { useTheme, Card, ProgressRing, ProgressBar, Button, Input, SectionHeader, PageTitle } from '../lib/theme';

export default function HabitPage() {
  const t = useTheme();
  const [habit, setHabit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [todayDone, setTodayDone] = useState(false);

  const uid = auth.currentUser?.uid;

  useEffect(() => { loadHabit(); }, []);

  async function loadHabit() {
    try {
      const snap = await getDocs(collection(db, 'habits66', uid));
      snap.forEach(d => {
        const h = d.data();
        if (h.status === 'active') {
          setHabit({ id: d.id, ...h });
          const today = new Date().toISOString().slice(0, 10);
          const todayEntry = (h.history || []).find(e => e.date === today);
          setTodayDone(!!todayEntry?.completed);
        }
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function startHabit() {
    if (!newHabit.trim()) return;
    const id = `habit_${Date.now()}`;
    const data = {
      title: newHabit.trim(), targetDays: 66, currentDay: 0,
      status: 'active', missedYesterday: false,
      history: [], resets: 0, startDate: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'habits66', uid, id), data);
    setHabit({ id, ...data });
    setShowSetup(false);
    setNewHabit('');
  }

  async function markToday(done) {
    if (!habit) return;
    const today = new Date().toISOString().slice(0, 10);
    const history = [...(habit.history || [])];
    const existing = history.findIndex(e => e.date === today);
    if (existing >= 0) history[existing] = { date: today, completed: done };
    else history.push({ date: today, completed: done });

    let { currentDay, missedYesterday, resets, status } = habit;

    if (done) {
      currentDay = history.filter(e => e.completed).length;
      missedYesterday = false;
      if (currentDay >= habit.targetDays) status = 'completed';
    } else {
      // Never miss twice logic
      if (missedYesterday) {
        // Two consecutive misses — reset
        resets += 1;
        currentDay = 0;
        missedYesterday = false;
      } else {
        missedYesterday = true;
      }
    }

    const updates = { history, currentDay, missedYesterday, resets, status };
    await updateDoc(doc(db, 'habits66', uid, habit.id), updates);
    setHabit(prev => ({ ...prev, ...updates }));
    setTodayDone(done);
  }

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: t.textTer }}>Loading...</div>;

  // No active habit — show setup
  if (!habit) return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label="66-Day Habit Challenge" color={t.accent}/>
        <PageTitle>Build One Habit</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: "8px 0 0", lineHeight: 1.6 }}>
          Choose ONE habit to build over the next 66 days. Research shows it takes about 66 days to form a lasting habit.
          Focus on one thing — don't spread yourself thin.
        </p>
      </div>

      <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 20, textAlign: "center", padding: "40px 24px" }}>
        <p style={{ fontSize: 48, margin: "0 0 16px" }}>🔥</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>No active habit</p>
        <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 20px", lineHeight: 1.5 }}>
          Pick something meaningful. Something that, if you did it every day for 66 days, would genuinely change your life.
        </p>
        <Button onClick={() => setShowSetup(true)}>Start a 66-Day Habit</Button>
      </Card>

      {showSetup && (
        <Card>
          <Input label="What habit will you build?" value={newHabit} onChange={setNewHabit}
            placeholder="e.g. Read for 30 minutes, Exercise, Write 500 words"/>
          <p style={{ fontSize: 12, color: t.textTer, margin: "-8px 0 16px", lineHeight: 1.5 }}>
            Rule: never miss twice. One miss is fine — two consecutive days resets everything.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={() => setShowSetup(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={startHabit} disabled={!newHabit.trim()} style={{ flex: 2 }}>Begin 🚀</Button>
          </div>
        </Card>
      )}
    </div>
  );

  // Active habit view
  const h = habit;
  const progress = Math.round((h.currentDay / h.targetDays) * 100);
  const doneCount = (h.history || []).filter(d => d.completed).length;
  const totalDays = (h.history || []).length || 1;
  const consistency = Math.round((doneCount / totalDays) * 100);

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label="66-Day Habit Challenge" color={t.accent}/>
        <PageTitle>{h.title}</PageTitle>
      </div>

      {/* Progress hero */}
      <Card bg={t.bgAccentSofter} border={t.accentBorder}
        style={{ marginBottom: 18, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px" }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <ProgressRing value={progress} size={130} stroke={8}/>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif" }}>{h.currentDay}</span>
            <span style={{ fontSize: 12, color: t.textSec }}>of {h.targetDays} days</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {[
            { v: `${consistency}%`, l: "Consistency", c: t.success },
            { v: Math.max(0, h.targetDays - h.currentDay), l: "Days left", c: t.info },
            { v: h.resets || 0, l: "Resets", c: t.purple },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: t.textTer, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Warning */}
      {h.missedYesterday && (
        <Card bg={t.dangerBg} border="rgba(192,57,43,0.2)"
          style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: t.danger, margin: 0 }}>You missed yesterday!</p>
            <p style={{ fontSize: 12, color: t.text, margin: "2px 0 0" }}>Don't miss today — two in a row resets everything.</p>
          </div>
        </Card>
      )}

      {/* Completed */}
      {h.status === 'completed' && (
        <Card bg={t.successBg} border={t.successBdr}
          style={{ marginBottom: 16, textAlign: "center", padding: "24px" }}>
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🎉</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: t.success, margin: "0 0 4px" }}>Habit Formed!</p>
          <p style={{ fontSize: 13, color: t.text, margin: 0 }}>You completed 66 days. This is now part of who you are.</p>
        </Card>
      )}

      {/* Today check-in */}
      {h.status === 'active' && (
        <Card style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 12px" }}>
            Today — Day {h.currentDay + 1}
          </p>
          {todayDone ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <p style={{ fontSize: 16, color: t.success, fontWeight: 700, margin: 0 }}>✓ Done for today!</p>
              <p style={{ fontSize: 12, color: t.textTer, margin: "4px 0 0" }}>Come back tomorrow to keep the chain going.</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => markToday(true)} style={{
                flex: 1, padding: "14px", borderRadius: 12, border: "none",
                background: t.success, color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>✓ Done today</button>
              <button onClick={() => markToday(false)} style={{
                padding: "14px 20px", borderRadius: 12,
                border: `1px solid ${t.border}`, background: t.bgCard,
                color: t.textSec, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>Missed</button>
            </div>
          )}
        </Card>
      )}

      {/* Calendar grid */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 14px" }}>Progress map</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 4 }}>
          {Array.from({ length: h.targetDays }, (_, i) => {
            const entry = (h.history || [])[i];
            const past = i < (h.history || []).length;
            const today = i === (h.history || []).length;
            let bg = t.bgSurface;
            if (past && entry?.completed) bg = t.success;
            else if (past && !entry?.completed) bg = t.danger;
            return (
              <div key={i} style={{
                aspectRatio: "1", borderRadius: 4, background: bg,
                opacity: past ? (entry?.completed ? 0.75 : 0.55) : 0.35,
                border: today ? `2px solid ${t.accent}` : "none",
              }} title={`Day ${i + 1}`}/>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, justifyContent: "center" }}>
          {[{ c: t.success, l: "Done" }, { c: t.danger, l: "Missed" }, { c: t.bgSurface, l: "Upcoming" }].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textTer }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c, opacity: 0.75 }}/>{x.l}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
