import { useEffect, useState } from 'react';
import { useTheme, Card, ProgressBar, Badge, SectionHeader, pct, goalColor } from '../lib/theme';
import { getMemberDeepStats, calculateMemberFines } from '../lib/team';

// Detailed view of one team member — used by Lead tab.
// Shows: monthly goals, today's progress, 66-day habit, weekly plan completion,
// earnings breakdown, outstanding fines.
export default function MemberDetailModal({ member, onClose }) {
  const t = useTheme();
  const [stats, setStats] = useState(null);
  const [fines, setFines] = useState({ totalFine: 0, overdueTasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, f] = await Promise.all([
          getMemberDeepStats(member.uid),
          calculateMemberFines(member.uid),
        ]);
        if (cancelled) return;
        setStats(s);
        setFines(f);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [member.uid]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, width: '100%', maxWidth: 480, maxHeight: '92vh',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>
              {member.name || 'Unknown'}
            </h2>
            <p style={{ fontSize: 11, color: t.textTer, margin: '4px 0 0' }}>
              {member.memberId || '—'} · joined {member.joinedTeamAt?.toDate?.()?.toLocaleDateString() || '—'}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 24, color: t.textTer, cursor: 'pointer',
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: t.textTer }}>Loading...</div>
        ) : (
          <>
            {/* Quick numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <Stat t={t} v={`${stats.goals.length}`} l="Goals"/>
              <Stat t={t} v={`${stats.todayProgress}%`} l="Today" c={stats.todayProgress >= 50 ? t.success : t.danger}/>
              <Stat t={t} v={stats.habit ? `D${stats.habit.currentDay}` : '—'} l="Habit"/>
            </div>

            {/* Earnings */}
            {stats.earningsThisMonth > 0 && (
              <Card bg={t.successBg} border={t.successBdr} style={{ marginBottom: 12 }}>
                <SectionHeader label="Earnings this month" color={t.success}/>
                <p style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", margin: '4px 0 6px' }}>
                  ${stats.earningsThisMonth.toLocaleString()}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(stats.earningsBreakdown).map(([src, amt]) => (
                    <Badge key={src} label={`${src}: $${amt.toLocaleString()}`}
                      color={t.success} bg={t.successBg}/>
                  ))}
                </div>
              </Card>
            )}

            {/* Fines */}
            {fines.totalFine > 0 && (
              <Card bg={t.dangerBg} border="rgba(192,57,43,0.2)" style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.danger, margin: '0 0 4px' }}>
                  💸 Outstanding fines: ₦{fines.totalFine.toLocaleString()}
                </p>
                <p style={{ fontSize: 12, color: t.text, margin: 0 }}>
                  {fines.overdueTasks.length} overdue task{fines.overdueTasks.length !== 1 ? 's' : ''}
                </p>
              </Card>
            )}

            {/* Habit */}
            {stats.habit && (
              <Card style={{ marginBottom: 12 }}>
                <SectionHeader label="66-day habit"/>
                <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: '4px 0 6px' }}>{stats.habit.title}</p>
                <ProgressBar value={pct(stats.habit.currentDay, stats.habit.targetDays)} color={t.purple}/>
                <p style={{ fontSize: 12, color: t.textSec, margin: '6px 0 0' }}>
                  Day {stats.habit.currentDay}/{stats.habit.targetDays} · Consistency {stats.habit.consistency}% · {stats.habit.resets} resets
                </p>
              </Card>
            )}

            {/* Goals */}
            {stats.goals.length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <SectionHeader label={`Monthly goals (${stats.goals.length})`}/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {stats.goals.map(g => {
                    const v = pct(g.current || 0, g.target || 1);
                    const c = goalColor(v, t);
                    return (
                      <div key={g.id} style={{
                        background: t.bgSurface, padding: '10px 12px', borderRadius: 8,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                            {g.icon || '🎯'} {g.title}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "'Playfair Display', serif" }}>{v}%</span>
                        </div>
                        <ProgressBar value={v} color={c} height={4}/>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Weekly plans */}
            {stats.weeklyPlans.length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <SectionHeader label="Weekly plan progress"/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {stats.weeklyPlans.map(w => {
                    const total = w.actions?.length || 0;
                    const done = w.actions?.filter(a => a.completed).length || 0;
                    const v = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={w.weekNumber} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 8, background: t.bgSurface,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: t.text, width: 50 }}>W{w.weekNumber}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: t.text, margin: 0 }}>{w.theme || 'No theme'}</p>
                          <ProgressBar value={v} color={v >= 75 ? t.success : t.accent} height={4}/>
                        </div>
                        <span style={{ fontSize: 11, color: t.textSec, width: 60, textAlign: 'right' }}>{done}/{total}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {stats.goals.length === 0 && !stats.habit && stats.earningsThisMonth === 0 && (
              <Card style={{ textAlign: 'center', padding: '24px 16px' }}>
                <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>
                  This member hasn't set goals or logged activity this month yet.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ t, v, l, c }) {
  return (
    <div style={{ padding: '12px 8px', borderRadius: 10, background: t.bgSurface, textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: c || t.text, fontFamily: "'Playfair Display', serif", margin: 0 }}>{v}</p>
      <p style={{ fontSize: 10, color: t.textTer, margin: '2px 0 0' }}>{l}</p>
    </div>
  );
}
