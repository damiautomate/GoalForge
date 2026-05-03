import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, collection, getDocs } from '../lib/firebase';
import { useTheme, Card, ProgressBar, SectionHeader, PageTitle, pct, paceText, goalColor } from '../lib/theme';
import DailyInsightCard from '../components/DailyInsightCard';
import EarningsCard from '../components/EarningsCard';

export default function Dashboard() {
  const t = useTheme();
  const [goals, setGoals] = useState([]);
  const [habit, setHabit] = useState(null);
  const [plan, setPlan] = useState(null);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
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
      const goalsSnap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const goalsData = [];
      goalsSnap.forEach(d => goalsData.push({ id: d.id, ...d.data() }));
      setGoals(goalsData);

      const planSnap = await getDoc(doc(db, 'yearlyPlans', uid, year, 'plan'));
      if (planSnap.exists()) setPlan(planSnap.data());

      const habitsSnap = await getDocs(collection(db, 'habits66', uid));
      habitsSnap.forEach(d => {
        const h = d.data();
        if (h.status === 'active') setHabit({ id: d.id, ...h });
      });

      // Load this month's weekly plans for insight context
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const totalWeeks = Math.ceil(daysInMonth / 7);
      const weeks = [];
      for (let w = 1; w <= totalWeeks; w++) {
        const wSnap = await getDoc(doc(db, 'weeklyPlans', uid, ym, `week${w}`));
        if (wSnap.exists()) weeks.push({ weekNumber: w, ...wSnap.data() });
      }
      setWeeklyPlans(weeks);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const user = auth.currentUser;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const overall = goals.length ? Math.round(goals.reduce((s, g) => s + pct(g.current || 0, g.target || 1), 0) / goals.length) : 0;

  const habitDay = habit?.currentDay || 0;
  const habitHist = habit?.history || [];
  const habitDone = habitHist.filter(d => d.completed).length;
  const consistency = habitHist.length ? Math.round((habitDone / habitHist.length) * 100) : 0;

  const monthlyIncomeTarget = plan?.income?.monthlyTarget || 0;

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

      {/* Daily insight (refreshes daily) */}
      <DailyInsightCard goals={goals} yearlyPlan={plan} weeklyPlans={weeklyPlans}
        habit={habit ? { ...habit, consistency } : null}/>

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

      {/* Earnings card (replaces old income card) */}
      <EarningsCard monthlyTarget={monthlyIncomeTarget}/>

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
