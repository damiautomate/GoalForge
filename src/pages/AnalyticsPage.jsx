import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc } from '../lib/firebase';
import { useTheme, Card, Button, ProgressBar, Badge, SectionHeader, PageTitle } from '../lib/theme';
import { generateMonthReport, getHistoricalReports, getYearlyStats } from '../lib/analytics';
import { analyzeTrends } from '../lib/ai';

export default function AnalyticsPage() {
  const t = useTheme();
  const [reports, setReports] = useState([]);
  const [yearStats, setYearStats] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const uid = auth.currentUser?.uid;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [r, y, yp] = await Promise.all([
        getHistoricalReports(uid, 12),
        getYearlyStats(uid),
        getDoc(doc(db, 'yearlyPlans', uid, String(now.getFullYear()), 'plan')),
      ]);
      setReports(r);
      setYearStats(y);
      if (yp.exists()) setYearlyPlan(yp.data());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleGenerateCurrent() {
    setGenerating(true);
    try {
      await generateMonthReport(uid, currentYm);
      await loadData();
    } catch (e) { console.error(e); alert('Failed: ' + e.message); }
    setGenerating(false);
  }

  async function handleCloseOutPrev() {
    setGenerating(true);
    try {
      await generateMonthReport(uid, prevYm);
      await loadData();
    } catch (e) { console.error(e); alert('Failed: ' + e.message); }
    setGenerating(false);
  }

  async function handleAnalyzeTrends() {
    if (reports.length < 2) {
      alert('Need at least 2 months of data for trend analysis.');
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeTrends(reports, yearlyPlan);
      setTrendAnalysis(result);
    } catch (e) {
      console.error(e);
      alert('Analysis failed. Check API key.');
    }
    setAnalyzing(false);
  }

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: t.textTer }}>Loading...</div>;

  const hasCurrentReport = reports.some(r => r.yearMonth === currentYm);
  const hasPrevReport = reports.some(r => r.yearMonth === prevYm);
  const maxChartVal = Math.max(100, ...(yearStats?.trendData?.map(d => d.completion) || [0]));

  const trendColors = {
    improving: t.success, declining: t.danger, stable: t.info,
    volatile: t.accent, insufficient_data: t.textTer,
  };
  const trendLabels = {
    improving: "📈 Improving", declining: "📉 Declining", stable: "➡️ Stable",
    volatile: "🌊 Volatile", insufficient_data: "⏳ Early days",
  };

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label="Analytics & History" color={t.info}/>
        <PageTitle>Your Progress Story</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: "6px 0 0" }}>
          {reports.length} month{reports.length !== 1 ? 's' : ''} of data · {yearStats?.activeMonths || 0} active this year
        </p>
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "36px 20px", marginBottom: 14 }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>📊</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>No reports yet</p>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 18px", lineHeight: 1.5 }}>
            Generate a report for this month to start building your history.
          </p>
          <Button onClick={handleGenerateCurrent} disabled={generating}>
            {generating ? 'Generating...' : 'Generate this month\'s report'}
          </Button>
        </Card>
      ) : (
        <>
          {/* YTD summary */}
          {yearStats && (
            <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>
                {now.getFullYear()} Year-to-Date
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", margin: 0, lineHeight: 1 }}>
                    {yearStats.avgCompletionRate}%
                  </p>
                  <p style={{ fontSize: 10, color: t.textTer, margin: "4px 0 0" }}>Avg Completion</p>
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: t.success, fontFamily: "'Playfair Display', serif", margin: 0, lineHeight: 1 }}>
                    {yearStats.totalCompleted}
                  </p>
                  <p style={{ fontSize: 10, color: t.textTer, margin: "4px 0 0" }}>Goals Completed</p>
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: t.purple, fontFamily: "'Playfair Display', serif", margin: 0, lineHeight: 1 }}>
                    {yearStats.totalHabitDays}
                  </p>
                  <p style={{ fontSize: 10, color: t.textTer, margin: "4px 0 0" }}>Habit Days Done</p>
                </div>
              </div>
              {yearStats.bestMonth && (
                <p style={{ fontSize: 11, color: t.textSec, margin: "12px 0 0", borderTop: `1px solid ${t.borderLt}`, paddingTop: 10 }}>
                  🏆 Best month: {new Date(yearStats.bestMonth.yearMonth + '-01').toLocaleString('en', { month: 'long' })} ({yearStats.bestMonth.completionRate}%)
                </p>
              )}
            </Card>
          )}

          {/* Trend chart */}
          {yearStats?.trendData?.length > 1 && (
            <Card style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>Monthly Completion Trend</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, padding: "0 0 20px" }}>
                {yearStats.trendData.map((d, i) => {
                  const height = Math.max(4, (d.completion / maxChartVal) * 100);
                  const color = d.completion >= 75 ? t.success : d.completion >= 50 ? t.accent : t.danger;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, color: t.textTer, fontWeight: 600 }}>{d.completion}%</span>
                      <div style={{
                        width: "100%", height: `${height}%`, background: color,
                        borderRadius: "4px 4px 0 0", minHeight: 4,
                        transition: "height 0.8s cubic-bezier(0.4,0,0.2,1)",
                      }}/>
                      <span style={{ fontSize: 9, color: t.textTer }}>{d.monthName}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Category breakdown */}
          {yearStats?.categoryBreakdown && Object.keys(yearStats.categoryBreakdown).length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>By Category (YTD)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(yearStats.categoryBreakdown)
                  .sort((a, b) => b[1].goals - a[1].goals)
                  .map(([cat, stats]) => {
                    const rate = stats.goals ? Math.round((stats.completed / stats.goals) * 100) : 0;
                    const color = rate >= 75 ? t.success : rate >= 50 ? t.accent : t.danger;
                    return (
                      <div key={cat}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{cat}</span>
                          <span style={{ fontSize: 12, color: t.textSec }}>
                            {stats.completed}/{stats.goals} · {rate}%
                          </span>
                        </div>
                        <ProgressBar value={rate} color={color} height={5}/>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* AI Trend Analysis */}
          <Card style={{ marginBottom: 14 }}>
            {!trendAnalysis ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>🤖 AI Trend Analysis</p>
                <p style={{ fontSize: 12, color: t.textSec, margin: "0 0 14px", lineHeight: 1.5 }}>
                  Let AI analyze your history and spot patterns, strengths, and areas to work on.
                </p>
                <Button onClick={handleAnalyzeTrends} disabled={analyzing || reports.length < 2}>
                  {analyzing ? 'Analyzing...' : reports.length < 2 ? 'Need 2+ months of data' : 'Analyze my trends'}
                </Button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>🤖 AI Analysis</p>
                  <Badge label={trendLabels[trendAnalysis.overallTrend]}
                    color={trendColors[trendAnalysis.overallTrend]}
                    bg={`${trendColors[trendAnalysis.overallTrend]}20`}/>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 14px", lineHeight: 1.5, fontStyle: "italic" }}>
                  "{trendAnalysis.headline}"
                </p>

                {trendAnalysis.strengths?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: t.success, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>💪 Strengths</p>
                    {trendAnalysis.strengths.map((s, i) => (
                      <p key={i} style={{ fontSize: 12, color: t.text, margin: "4px 0", lineHeight: 1.5, paddingLeft: 12 }}>• {s}</p>
                    ))}
                  </div>
                )}

                {trendAnalysis.patterns?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: t.purple, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>🔍 Patterns</p>
                    {trendAnalysis.patterns.map((s, i) => (
                      <p key={i} style={{ fontSize: 12, color: t.text, margin: "4px 0", lineHeight: 1.5, paddingLeft: 12 }}>• {s}</p>
                    ))}
                  </div>
                )}

                {trendAnalysis.recommendations?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: t.accent, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>🎯 Next Month</p>
                    {trendAnalysis.recommendations.map((s, i) => (
                      <p key={i} style={{ fontSize: 12, color: t.text, margin: "4px 0", lineHeight: 1.5, paddingLeft: 12 }}>• {s}</p>
                    ))}
                  </div>
                )}

                {trendAnalysis.celebration && (
                  <div style={{ background: t.successBg, borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
                    <p style={{ fontSize: 12, color: t.success, margin: 0, fontWeight: 500 }}>
                      🎉 {trendAnalysis.celebration}
                    </p>
                  </div>
                )}

                <button onClick={handleAnalyzeTrends} disabled={analyzing} style={{
                  width: "100%", padding: "9px", borderRadius: 10, marginTop: 12,
                  border: `1px solid ${t.border}`, background: t.bgCard,
                  color: t.textSec, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}>🔄 Re-analyze</button>
              </>
            )}
          </Card>

          {/* Generate / Close-out actions */}
          {(!hasCurrentReport || !hasPrevReport) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {!hasCurrentReport && (
                <button onClick={handleGenerateCurrent} disabled={generating} style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: `1.5px dashed ${t.accentBorder}`, background: t.bgAccentSofter,
                  color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>📊 This month's report</button>
              )}
              {!hasPrevReport && (
                <button onClick={handleCloseOutPrev} disabled={generating} style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: `1.5px dashed ${t.border}`, background: t.bgCard,
                  color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>📁 Close out {prevMonth.toLocaleString('en', { month: 'short' })}</button>
              )}
            </div>
          )}

          {/* Month reports list */}
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 10px" }}>Month Reports</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...reports].reverse().map(r => {
              const rateColor = r.completionRate >= 75 ? t.success : r.completionRate >= 50 ? t.accent : t.danger;
              const monthName = new Date(r.year, r.month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
              const isCurrent = r.yearMonth === currentYm;
              const isSelected = selectedReport?.yearMonth === r.yearMonth;
              return (
                <Card key={r.yearMonth} onClick={() => setSelectedReport(isSelected ? null : r)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>
                        {monthName}
                        {isCurrent && <span style={{ fontSize: 9, marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: t.accentBg, color: t.accent, fontWeight: 700 }}>CURRENT</span>}
                      </p>
                      <p style={{ fontSize: 11, color: t.textTer, margin: "2px 0 0" }}>
                        {r.goalsCompleted}/{r.goalsSet} goals · avg {r.avgProgress}%
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: rateColor, fontFamily: "'Playfair Display', serif", margin: 0, lineHeight: 1 }}>
                        {r.completionRate}%
                      </p>
                      <p style={{ fontSize: 10, color: t.textTer, margin: "2px 0 0" }}>completion</p>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isSelected && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.borderLt}` }}>
                      {/* Types */}
                      {r.byType && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                          {Object.entries(r.byType).filter(([,v]) => v > 0).map(([type, count]) => (
                            <div key={type} style={{ padding: "8px 10px", borderRadius: 8, background: t.bgSurface, display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: t.textSec, textTransform: "capitalize" }}>{type}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
                                {r.typeCompleted?.[type] || 0}/{count}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Habit */}
                      {r.habitStats && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: t.purpleBg, marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: t.purple, letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 4px" }}>66-Day Habit</p>
                          <p style={{ fontSize: 13, color: t.text, margin: 0 }}>
                            {r.habitStats.title}: {r.habitStats.daysDone}/{r.habitStats.daysAttempted} days ({r.habitStats.consistency}%)
                          </p>
                        </div>
                      )}

                      {/* Weeks */}
                      {r.weeks?.length > 0 && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: t.textSec, letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 6px" }}>Weekly Plans</p>
                          {r.weeks.map(w => (
                            <div key={w.week} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                              <span style={{ color: t.text }}>Week {w.week}: {w.theme || 'No theme'}</span>
                              <span style={{ color: t.textTer }}>{w.completedActions}/{w.totalActions} actions</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {r.rolledForward > 0 && (
                        <p style={{ fontSize: 11, color: t.textTer, margin: "10px 0 0", fontStyle: "italic" }}>
                          📎 {r.rolledForward} goal{r.rolledForward !== 1 ? 's' : ''} rolled forward from previous month
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
