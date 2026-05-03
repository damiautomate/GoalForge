import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useTheme, Card, ProgressBar, SectionHeader } from '../lib/theme';
import { getLeaderboard } from '../lib/team';

// Renders top performers + own rank.
// `enabled` comes from the team config; if false, we don't render at all.
// `showTop` defaults to 5; you can pass 10.
// `isLeader` lets the leader peek even if not in top N.
export default function Leaderboard({ teamId, leaderUid, enabled, showTop = 5, currentUserUid, onMemberClick }) {
  const t = useTheme();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !teamId || !leaderUid) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getLeaderboard(teamId, leaderUid);
        if (!cancelled) setRows(data);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [teamId, leaderUid, enabled]);

  if (!enabled) return null;
  if (loading) return (
    <Card style={{ marginBottom: 14, padding: '14px 18px' }}>
      <SectionHeader label="Top performers" color={t.purple}/>
      <p style={{ fontSize: 13, color: t.textSec, margin: 0 }}>Calculating ranks...</p>
    </Card>
  );
  if (!rows?.length) return null;

  const visible = rows.filter(r => !r.optedOut);
  const top = visible.slice(0, showTop);
  const ownRow = currentUserUid ? visible.find(r => r.uid === currentUserUid) : null;
  const ownRank = ownRow ? visible.findIndex(r => r.uid === currentUserUid) + 1 : null;
  const ownInTop = ownRow && top.some(r => r.uid === currentUserUid);

  return (
    <Card style={{ marginBottom: 14, padding: '14px 18px' }}>
      <SectionHeader label="Top performers" color={t.purple}/>
      <p style={{ fontSize: 11, color: t.textTer, margin: '0 0 10px' }}>
        Score = 50% goals · 30% habit · 20% assigned tasks
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {top.map((r, i) => <Row key={r.uid} rank={i + 1} row={r} t={t}
          isYou={r.uid === currentUserUid} onClick={onMemberClick}/>)}
      </div>

      {ownRow && !ownInTop && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${t.border}` }}>
          <Row rank={ownRank} row={ownRow} t={t} isYou={true} onClick={onMemberClick}/>
        </div>
      )}
    </Card>
  );
}

function Row({ rank, row, t, isYou, onClick }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  return (
    <div onClick={onClick ? () => onClick(row) : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 10,
      background: isYou ? t.bgAccentSofter : t.bgSurface,
      border: `1px solid ${isYou ? t.accentBorder : t.borderLt}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: t.text, width: 30, textAlign: 'center' }}>{medal}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>
          {row.name}{isYou && <span style={{ color: t.accent, fontSize: 10, marginLeft: 6, fontWeight: 700 }}>YOU</span>}
        </p>
        <p style={{ fontSize: 10, color: t.textTer, margin: '2px 0 0' }}>
          Goals {row.avgGoalProgress}% · Habit {row.habitConsistency}% · Tasks {row.assignedCompletion}%
        </p>
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, color: t.purple, fontFamily: "'Playfair Display', serif" }}>
        {row.score}
      </span>
    </div>
  );
}
