import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDocs, getDoc, collection, serverTimestamp } from '../lib/firebase';
import { useTheme, Card, Button, Badge, ProgressBar, pct } from '../lib/theme';
import { generateMonthReport } from '../lib/analytics';

export default function GoalRollover({ onComplete }) {
  const t = useTheme();
  const [prevGoals, setPrevGoals] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = auth.currentUser?.uid;
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
  const currYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonthName = prevMonth.toLocaleString('en', { month: 'long' });

  useEffect(() => { loadPrevGoals(); }, []);

  async function loadPrevGoals() {
    try {
      const snap = await getDocs(collection(db, 'monthlyGoals', uid, prevYm));
      const incomplete = [];
      snap.forEach(d => {
        const g = { id: d.id, ...d.data() };
        const progress = pct(g.current || 0, g.target || 1);
        if (progress < 100) incomplete.push(g);
      });
      setPrevGoals(incomplete);
      // Auto-select all by default
      setSelected(new Set(incomplete.map(g => g.id)));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function rollForward() {
    setSaving(true);
    try {
      for (const g of prevGoals) {
        if (!selected.has(g.id)) continue;
        const newId = `rollover_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const remaining = (g.target || 0) - (g.current || 0);
        await setDoc(doc(db, 'monthlyGoals', uid, currYm, newId), {
          title: g.title,
          type: g.type,
          target: g.type === 'checklist' ? 1 : Math.max(remaining, 1),
          current: 0,
          unit: g.unit,
          category: g.category,
          icon: g.icon || '🎯',
          status: 'active',
          source: 'rollover',
          rolledFrom: prevYm,
          originalTarget: g.target,
          previousProgress: g.current || 0,
          createdAt: serverTimestamp(),
        });
      }

      // Generate full month close-out report (not just basic stats)
      await generateMonthReport(uid, prevYm);

      onComplete?.();
    } catch (e) {
      console.error(e);
      alert('Failed to roll forward goals.');
    }
    setSaving(false);
  }

  if (loading) return null;
  if (prevGoals.length === 0) return null;

  return (
    <Card border={t.accentBorder} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>Roll forward from {prevMonthName}</p>
          <p style={{ fontSize: 12, color: t.textSec, margin: "2px 0 0" }}>
            {prevGoals.length} unfinished goal{prevGoals.length !== 1 ? 's' : ''}. Pick which ones to carry forward.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {prevGoals.map(g => {
          const progress = pct(g.current || 0, g.target || 1);
          const isSelected = selected.has(g.id);
          return (
            <div key={g.id} onClick={() => toggle(g.id)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              background: isSelected ? t.accentBg : t.bgSurface,
              border: `1px solid ${isSelected ? t.accentBorder : t.borderLt}`,
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                background: isSelected ? t.accent : "transparent",
                border: `2px solid ${isSelected ? t.accent : t.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 700,
              }}>{isSelected ? "✓" : ""}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "0 0 4px" }}>{g.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProgressBar value={progress} height={4} color={t.accent}/>
                  <span style={{ fontSize: 11, color: t.textTer, whiteSpace: "nowrap" }}>{progress}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={() => onComplete?.()} style={{ flex: 1 }}>Skip all</Button>
        <Button onClick={rollForward} disabled={saving || selected.size === 0} style={{ flex: 2 }}>
          {saving ? 'Rolling forward...' : `Roll forward ${selected.size} goal${selected.size !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </Card>
  );
}
