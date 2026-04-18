// Analytics service — historical data aggregation for trends and reports
import { db, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from './firebase';
import { query, where, orderBy, limit } from 'firebase/firestore';
import { auth } from './firebase';

// ── Generate month close-out report ──
export async function generateMonthReport(uid, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);

  const goalsSnap = await getDocs(collection(db, 'monthlyGoals', uid, yearMonth));
  const goals = [];
  goalsSnap.forEach(d => goals.push({ id: d.id, ...d.data() }));

  let totalProgress = 0;
  let completedCount = 0;
  const byCategory = {};
  const byType = { target: 0, measurable: 0, habit: 0, checklist: 0 };
  const typeCompleted = { target: 0, measurable: 0, habit: 0, checklist: 0 };
  const rolledForward = goals.filter(g => g.source === 'rollover').length;

  for (const g of goals) {
    const pct = g.target ? Math.min(100, Math.round(((g.current || 0) / g.target) * 100)) : 0;
    totalProgress += pct;
    if (pct >= 100) completedCount++;

    const cat = g.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, completed: 0, avgProgress: 0, sumPct: 0 };
    byCategory[cat].total += 1;
    byCategory[cat].sumPct += pct;
    if (pct >= 100) byCategory[cat].completed += 1;

    if (byType[g.type] !== undefined) {
      byType[g.type]++;
      if (pct >= 100) typeCompleted[g.type]++;
    }
  }

  // Finalize category averages
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].avgProgress = Math.round(byCategory[cat].sumPct / byCategory[cat].total);
    delete byCategory[cat].sumPct;
  }

  // Read habit data for the month
  const habitsSnap = await getDocs(collection(db, 'habits66', uid));
  let habitStats = null;
  habitsSnap.forEach(d => {
    const h = d.data();
    const monthDays = (h.history || []).filter(entry => entry.date?.startsWith(yearMonth));
    if (monthDays.length > 0) {
      const done = monthDays.filter(d => d.completed).length;
      habitStats = {
        title: h.title,
        daysAttempted: monthDays.length,
        daysDone: done,
        consistency: Math.round((done / monthDays.length) * 100),
        currentStreakAtMonthEnd: h.currentDay,
        resets: h.resets || 0,
      };
    }
  });

  // Read weekly plans for the month
  const weeks = [];
  for (let w = 1; w <= 5; w++) {
    const wDoc = await getDoc(doc(db, 'weeklyPlans', uid, yearMonth, `week${w}`));
    if (wDoc.exists()) {
      const wd = wDoc.data();
      const actions = wd.actions || [];
      weeks.push({
        week: w,
        theme: wd.theme,
        totalActions: actions.length,
        completedActions: actions.filter(a => a.completed).length,
        hasReflection: !!wd.reflection,
      });
    }
  }

  // Read sheet sync data if available
  const sheetDoc = await getDoc(doc(db, 'sheetLinks', uid, yearMonth, 'info'));
  const hasSheet = sheetDoc.exists();

  const report = {
    yearMonth, year, month,
    goalsSet: goals.length,
    goalsCompleted: completedCount,
    completionRate: goals.length ? Math.round((completedCount / goals.length) * 100) : 0,
    avgProgress: goals.length ? Math.round(totalProgress / goals.length) : 0,
    byCategory, byType, typeCompleted,
    rolledForward,
    habitStats,
    weeks,
    hasSheet,
    generatedAt: serverTimestamp(),
  };

  // Save report
  await setDoc(doc(db, 'monthlyReports', uid, yearMonth), report);

  return report;
}

// ── Get all historical reports (last N months) ──
export async function getHistoricalReports(uid, monthsBack = 12) {
  const reports = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const snap = await getDoc(doc(db, 'monthlyReports', uid, ym));
    if (snap.exists()) {
      reports.push({ yearMonth: ym, ...snap.data() });
    }
  }
  return reports.reverse(); // oldest first
}

// ── Compute year-to-date stats ──
export async function getYearlyStats(uid) {
  const year = new Date().getFullYear();
  const reports = await getHistoricalReports(uid, 12);
  const yearReports = reports.filter(r => r.yearMonth?.startsWith(String(year)));

  if (yearReports.length === 0) {
    return {
      totalGoals: 0, totalCompleted: 0, avgCompletionRate: 0,
      totalHabitDays: 0, bestMonth: null, activeMonths: 0,
      categoryBreakdown: {}, trendData: [],
    };
  }

  let totalGoals = 0, totalCompleted = 0, totalHabitDays = 0;
  const catTotals = {};
  let bestMonth = null;

  for (const r of yearReports) {
    totalGoals += r.goalsSet || 0;
    totalCompleted += r.goalsCompleted || 0;
    totalHabitDays += r.habitStats?.daysDone || 0;

    if (!bestMonth || (r.completionRate || 0) > (bestMonth.completionRate || 0)) {
      bestMonth = r;
    }

    for (const [cat, stats] of Object.entries(r.byCategory || {})) {
      if (!catTotals[cat]) catTotals[cat] = { goals: 0, completed: 0 };
      catTotals[cat].goals += stats.total;
      catTotals[cat].completed += stats.completed;
    }
  }

  const trendData = yearReports.map(r => ({
    yearMonth: r.yearMonth,
    monthName: new Date(r.year, r.month - 1).toLocaleString('en', { month: 'short' }),
    completion: r.completionRate || 0,
    avgProgress: r.avgProgress || 0,
    goals: r.goalsSet || 0,
  }));

  return {
    totalGoals, totalCompleted,
    avgCompletionRate: yearReports.length ? Math.round(yearReports.reduce((s, r) => s + (r.completionRate || 0), 0) / yearReports.length) : 0,
    totalHabitDays,
    bestMonth: bestMonth ? { yearMonth: bestMonth.yearMonth, completionRate: bestMonth.completionRate } : null,
    activeMonths: yearReports.length,
    categoryBreakdown: catTotals,
    trendData,
  };
}
