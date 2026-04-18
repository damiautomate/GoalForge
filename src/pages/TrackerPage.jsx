import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, getDocs, updateDoc, setDoc, collection } from '../lib/firebase';
import { useTheme, Card, Button, ProgressBar, Badge, SectionHeader, PageTitle, pct } from '../lib/theme';
import { generateSheet, syncSheet, goalsToSheetTasks } from '../lib/sheets';

export default function TrackerPage() {
  const t = useTheme();
  const [sheetInfo, setSheetInfo] = useState(null); // { spreadsheetId, tabName, url, taskCount }
  const [syncData, setSyncData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [yearlyPlan, setYearlyPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const uid = auth.currentUser?.uid;
  const user = auth.currentUser;
  const now = new Date();
  const monthName = now.toLocaleString('en', { month: 'long' });
  const year = now.getFullYear();
  const ym = `${year}-${String(now.getMonth()+1).padStart(2,'0')}`;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      // Load user profile for sheet ID
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data();

      // Load sheet info for this month
      const sheetDoc = await getDoc(doc(db, 'sheetLinks', uid, ym, 'info'));
      if (sheetDoc.exists()) setSheetInfo(sheetDoc.data());

      // Load goals
      const gSnap = await getDocs(collection(db, 'monthlyGoals', uid, ym));
      const g = []; gSnap.forEach(d => g.push({ id: d.id, ...d.data() }));
      setGoals(g);

      // Load yearly plan
      const ySnap = await getDoc(doc(db, 'yearlyPlans', uid, String(year), 'plan'));
      if (ySnap.exists()) setYearlyPlan(ySnap.data());
    } catch (e) { console.error(e); }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const dailyIPAs = yearlyPlan?.dailyStructure?.dailyIPAs || [];
      const tasks = goalsToSheetTasks(goals, dailyIPAs);

      // Check if user already has a spreadsheet
      const userDoc = await getDoc(doc(db, 'users', uid));
      const existingSheetId = userDoc.data()?.sheetId || null;

      const result = await generateSheet({
        userId: uid,
        userName: user?.displayName,
        monthName,
        year,
        tasks,
        fineAmount: 200,
        existingSheetId,
      });

      // Save sheet info
      const info = {
        spreadsheetId: result.spreadsheetId,
        tabName: result.tabName,
        url: result.url,
        taskCount: result.taskCount,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'sheetLinks', uid, ym, 'info'), info);
      setSheetInfo(info);

      // Save spreadsheet ID to user profile if new
      if (!existingSheetId) {
        await updateDoc(doc(db, 'users', uid), { sheetId: result.spreadsheetId });
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to generate sheet');
    }
    setGenerating(false);
  }

  async function handleSync() {
    if (!sheetInfo) return;
    setSyncing(true);
    setError('');
    try {
      const data = await syncSheet({
        spreadsheetId: sheetInfo.spreadsheetId,
        tabName: sheetInfo.tabName,
        taskCount: sheetInfo.taskCount,
      });
      setSyncData(data);

      // Update monthly goal progress based on sheet data
      const today = now.getDate();
      const todayData = data.days.find(d => d.day === today);
      if (todayData) {
        await setDoc(doc(db, 'dailyTasks', uid, now.toISOString().slice(0, 10)), {
          tasks: todayData.tasks.map(t => ({
            title: `Task ${t.index + 1}`,
            completed: t.done,
            completedVia: 'sheet',
          })),
          doneCount: todayData.doneCount,
          progress: todayData.progress,
          syncedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to sync');
    }
    setSyncing(false);
  }

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label="Daily Tracker" color={t.success}/>
        <PageTitle>Google Sheets</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: "6px 0 0" }}>
          Your daily execution happens here — check off tasks in the sheet.
        </p>
      </div>

      {error && (
        <Card bg={t.dangerBg} style={{ marginBottom: 14, padding: "12px 16px" }}>
          <p style={{ fontSize: 13, color: t.danger, margin: 0 }}>{error}</p>
        </Card>
      )}

      {/* No sheet yet */}
      {!sheetInfo ? (
        <Card style={{ textAlign: "center", padding: "32px 20px", marginBottom: 16 }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>📊</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>
            Generate {monthName} Tracker
          </p>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 8px", lineHeight: 1.6 }}>
            Creates a styled Google Sheet with your daily tasks, auto-calculated stats, 
            streaks, and weekly breakdowns — based on your goals and daily IPAs.
          </p>
          {goals.length === 0 && (
            <p style={{ fontSize: 12, color: t.accent, margin: "0 0 12px" }}>
              Tip: Set monthly goals first so the sheet columns match your actual tasks.
            </p>
          )}
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating sheet...' : '📋 Generate Daily Tracker'}
          </Button>
        </Card>
      ) : (
        <>
          {/* Sheet link card */}
          <Card bg={t.successBg} border={t.successBdr} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 2px" }}>
                  {monthName} {year} Tracker
                </p>
                <p style={{ fontSize: 12, color: t.textSec, margin: 0 }}>
                  {sheetInfo.taskCount} tasks · Created {new Date(sheetInfo.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a href={sheetInfo.url} target="_blank" rel="noopener noreferrer" style={{
                flex: 2, padding: "11px", borderRadius: 10, border: "none",
                background: t.success, color: "#fff", fontSize: 13, fontWeight: 700,
                textDecoration: "none", textAlign: "center", display: "block",
              }}>Open in Google Sheets →</a>
              <button onClick={handleSync} disabled={syncing} style={{
                flex: 1, padding: "11px", borderRadius: 10,
                border: `1px solid ${t.border}`, background: t.bgCard,
                color: t.info, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                opacity: syncing ? 0.5 : 1,
              }}>{syncing ? 'Syncing...' : '🔄 Sync'}</button>
            </div>
          </Card>

          {/* Regenerate option */}
          <button onClick={handleGenerate} disabled={generating} style={{
            width: "100%", padding: "11px", borderRadius: 12, marginBottom: 14,
            border: `1px solid ${t.border}`, background: t.bgCard,
            color: t.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>{generating ? 'Generating...' : '🔄 Regenerate this month\'s tracker (new tab)'}</button>

          {/* Sync data display */}
          {syncData && (
            <>
              {/* Summary stats */}
              <Card style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>📈 Monthly Summary</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { l: "Tasks Done", v: syncData.summary.totalDone, c: t.success },
                    { l: "Tasks Skipped", v: syncData.summary.totalSkipped, c: t.accent },
                    { l: "Completion", v: syncData.summary.overallCompletion, c: t.info },
                    { l: "Best Streak", v: `${syncData.summary.bestStreak} days`, c: t.purple },
                    { l: "Perfect Days", v: syncData.summary.perfectDays, c: t.success },
                    { l: "Total Fine", v: `₦${syncData.summary.totalFine.toLocaleString()}`, c: t.danger },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 10, background: t.bgSurface,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 12, color: t.textSec }}>{s.l}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Today's status */}
              {(() => {
                const today = syncData.days.find(d => d.day === now.getDate());
                if (!today) return null;
                const todayPct = Math.round(today.progress * 100);
                return (
                  <Card style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Today (Day {today.day})</p>
                      <span style={{ fontSize: 16, fontWeight: 800, color: todayPct >= 50 ? t.success : t.danger, fontFamily: "'Playfair Display', serif" }}>
                        {todayPct}%
                      </span>
                    </div>
                    <ProgressBar value={todayPct} color={todayPct >= 50 ? t.success : t.danger}/>
                    <p style={{ fontSize: 12, color: t.textSec, margin: "6px 0 0" }}>
                      {today.doneCount}/{today.totalTasks} tasks done · Streak: {today.streak} days
                    </p>
                  </Card>
                );
              })()}

              {/* Task hit rates */}
              {syncData.hitRates?.length > 0 && (
                <Card>
                  <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 12px" }}>Task Hit Rates</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {syncData.hitRates.map((rate, i) => {
                      const pctVal = rate === '—' ? 0 : Math.round(parseFloat(rate) * 100);
                      const color = pctVal >= 75 ? t.success : pctVal >= 50 ? t.accent : t.danger;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderRadius: 8, background: t.bgSurface,
                        }}>
                          <span style={{ fontSize: 12, color: t.textSec, width: 90, flexShrink: 0 }}>Task {i + 1}</span>
                          <div style={{ flex: 1 }}>
                            <ProgressBar value={pctVal} color={color} height={4}/>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color, width: 40, textAlign: "right" }}>
                            {rate === '—' ? '—' : `${pctVal}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <p style={{ fontSize: 11, color: t.textTer, textAlign: "center", margin: "12px 0 0" }}>
                Last synced: {new Date(syncData.lastSynced).toLocaleString()}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
