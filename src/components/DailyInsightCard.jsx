import { useEffect, useState } from 'react';
import { auth, db, doc, getDoc, setDoc, serverTimestamp } from '../lib/firebase';
import { useTheme, Card } from '../lib/theme';
import { generateDailyInsight } from '../lib/ai';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Daily refreshing AI insight. Caches in dailyInsights/{uid}/{YYYY-MM-DD}
// so we only call the AI once per day per user.
export default function DailyInsightCard({ goals, yearlyPlan, weeklyPlans, habit }) {
  const t = useTheme();
  const uid = auth.currentUser?.uid;
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dayOfWeek = DAYS[now.getDay()];

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        // Check cache
        const ref = doc(db, 'dailyInsights', uid, today);
        const snap = await getDoc(ref);
        if (snap.exists() && !cancelled) {
          setInsight(snap.data());
          setLoading(false);
          return;
        }

        if ((goals || []).length === 0) {
          // No goals yet — skip generation
          setLoading(false);
          return;
        }

        const result = await generateDailyInsight({
          goals, yearlyPlan, weeklyPlans, habit,
          dayOfWeek, daysLeftInMonth: daysLeft,
        });
        if (cancelled) return;
        const stored = { ...result, generatedAt: serverTimestamp(), date: today };
        await setDoc(ref, stored);
        setInsight(stored);
      } catch (e) {
        console.error('Daily insight error:', e);
        if (!cancelled) setError(e.message || 'Failed to generate insight');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, today, goals?.length]);

  if (loading) {
    return (
      <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 18, padding: '14px 18px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.accent, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's insight</p>
        <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>Reading your numbers...</p>
      </Card>
    );
  }

  if (error || !insight) return null;

  return (
    <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 18, padding: '14px 18px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: t.accent, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Today's insight
      </p>
      {insight.headline && (
        <p style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: '0 0 6px', fontFamily: "'Playfair Display', serif" }}>
          {insight.headline}
        </p>
      )}
      <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.55 }}>{insight.insight}</p>
      {insight.focus && (
        <p style={{ fontSize: 12, color: t.accent, margin: '8px 0 0', fontWeight: 600 }}>
          → {insight.focus}
        </p>
      )}
    </Card>
  );
}
