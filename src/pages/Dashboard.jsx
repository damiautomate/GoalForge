import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, collection, getDocs } from '../lib/firebase';
import { useTheme, Card, ProgressRing, ProgressBar, SectionHeader, PageTitle, pct, paceText, goalColor } from '../lib/theme';

export default function Dashboard() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [habit, setHabit] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const uid = auth.currentUser.uid;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const year = String(now.getFullYear());

    try {
      // Load monthly goals
      const goalsSnap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const goalsData = [];
      goalsSnap.forEach(d => goalsData.push({ id: d.id, ...d.data() }));
      setGoals(goalsData);

      // Load yearly plan
      const planSnap = await getDoc(doc(db, 'yearlyPlans', uid, year, 'plan'));
      if (planSnap.exists()) setPlan(planSnap.data());

      // Load active habit
      const habitsSnap = await getDocs(collection(db, 'habits66', uid));
      habitsSnap.forEach(d => {
        const h = d.data();
        if (h.status === 'active') setHabit({ id: d.id, ...h });
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const user = auth.currentUser;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const overall = goals.length ? Math.round(goals.reduce((s, g) => s + pct(g.current || 0, g.target || 1), 0) / goals.length) : 0;

  const habitDay = habit?.currentDay || 0;
  const habitTotal = habit?.targetDays || 66;
  const habitHist = habit?.history || [];
  const habitDone = habitHist.filter(d => d.completed).length;
  const consistency = habitHist.length ? Math.round((habitDone / habitHist.length) * 100) : 0;

  const incomeGoal = goals.find(g => g.category === 'Freelancing' && g.type === 'target' && g.unit === '$');

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 2px" }}>
          {greeting}, {user?.displayName?.split(' ')[0] || 'there'} 👋
        </p>
        <PageTitle>{now.toLocaleString('en', { month: 'long' })} Dashboard</PageTitle>
        <p style={{ fontSize: 13, color: t.textTer, margin: "6px 0 0" }}>
          {daysLeft} days remaining
          {plan?.wordOfYear && <> · Word: <span style={{ color: t.purple, fontWeight: 600 }}>{plan.wordOfYear}</span></>}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
        {[
          { l: "Monthly", v: `${overall}%`, c: t.accent },
          { l: "Consistency", v: goals.length ? `${consistency}%` : "—", c: t.success },
          { l: "66-Day", v: habit ? `Day ${habitDay}` : "Not set", c: t.purple },
        ].map((s, i) => (
          <Card key={i} style={{ padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: "'Playfair Display', serif" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: t.textTer, marginTop: 3, fontWeight: 500 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Income card */}
      {incomeGoal && (
        <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <SectionHeader label={`${now.toLocaleString('en', { month: 'long' })} income`}/>
              <p style={{ fontSize: 30, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", margin: "4px 0 0", lineHeight: 1.1 }}>
                ${(incomeGoal.current || 0).toLocaleString()} <span style={{ fontSize: 15, color: t.textTer, fontWeight: 400, fontFamily: "'DM Sans'" }}>/ ${(incomeGoal.target || 0).toLocaleString()}</span>
              </p>
            </div>
            <ProgressRing value={pct(incomeGoal.current || 0, incomeGoal.target || 1)} size={58} stroke={5}/>
          </div>
          <ProgressBar value={pct(incomeGoal.current || 0, incomeGoal.target || 1)}/>
          <p style={{ fontSize: 12, color: t.textSec, margin: "8px 0 0" }}>
            {paceText(incomeGoal.current || 0, incomeGoal.target || 1, daysLeft)}
          </p>
        </Card>
      )}

      {/* Goals */}
      {goals.length > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>Monthly Goals</h2>
            <span style={{ fontSize: 12, color: t.textTer }}>{goals.filter(g => pct(g.current||0, g.target||1) >= 100).length}/{goals.length} done</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {goals.slice(0, 5).map(g => {
              const v = pct(g.current || 0, g.target || 1);
              const c = goalColor(v, t);
              return (
                <Card key={g.id} style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{g.icon || '🎯'}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>{g.title}</p>
                        <p style={{ fontSize: 11, color: t.textTer, margin: "2px 0 0" }}>{g.category}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: "'Playfair Display', serif" }}>{v}%</span>
                  </div>
                  <ProgressBar value={v} color={c} height={5}/>
                  <p style={{ fontSize: 11, color: t.textSec, margin: "6px 0 0" }}>
                    {g.current || 0} {g.unit} / {g.target} {g.unit} · {paceText(g.current || 0, g.target || 1, daysLeft)}
                  </p>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🎯</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>No goals set yet</p>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 16px" }}>
            Head to the Goals tab to set up your monthly targets.
          </p>
        </Card>
      )}
    </div>
  );
}
