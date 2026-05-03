import { useState } from 'react';
import { useTheme, Button, Input } from '../lib/theme';

const DAYS = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_BLOCKS = [null, 'morning', 'afternoon', 'evening'];
const PRIORITIES = ['high', 'medium', 'low'];

// Edit a single weekly action — title, priority, day, time block, linked goal.
export default function WeeklyActionEditor({ action, goals, onClose, onSave, onDelete }) {
  const t = useTheme();
  const [form, setForm] = useState({
    title: action.title || '',
    priority: action.priority || 'medium',
    day: action.day || null,
    timeBlock: action.timeBlock || null,
    goalId: action.goalId || '',
    estimatedMinutes: action.estimatedMinutes || '',
  });

  function save() {
    if (!form.title.trim()) return;
    const goal = goals.find(g => g.id === form.goalId);
    onSave({
      ...action,
      title: form.title.trim(),
      priority: form.priority,
      day: form.day,
      timeBlock: form.timeBlock,
      goalId: form.goalId,
      goalTitle: goal?.title || action.goalTitle || '',
      estimatedMinutes: parseInt(form.estimatedMinutes) || null,
    });
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, width: '100%', maxWidth: 480, maxHeight: '92vh',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>
            Edit action
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 24, color: t.textTer, cursor: 'pointer',
          }}>×</button>
        </div>

        <Input label="Action" value={form.title} onChange={v => setForm(f => ({...f, title: v}))} placeholder="What will you do?" />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Linked goal</label>
          <select value={form.goalId} onChange={e => setForm(f => ({...f, goalId: e.target.value}))}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit' }}>
            <option value="">— No specific goal —</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.icon} {g.title}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Priority</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => setForm(f => ({...f, priority: p}))} style={{
                flex: 1, padding: '9px', borderRadius: 10,
                border: `1px solid ${form.priority === p ? t.accentBorder : t.border}`,
                background: form.priority === p ? t.accentBg : t.bgCard,
                color: form.priority === p ? t.accent : t.textSec,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}>{p}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Day</label>
          <select value={form.day || ''} onChange={e => setForm(f => ({...f, day: e.target.value || null}))}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit' }}>
            <option value="">Any day</option>
            {DAYS.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Time block</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIME_BLOCKS.map(tb => (
              <button key={tb || 'any'} onClick={() => setForm(f => ({...f, timeBlock: tb}))} style={{
                flex: '1 1 22%', padding: '9px', borderRadius: 10,
                border: `1px solid ${form.timeBlock === tb ? t.accentBorder : t.border}`,
                background: form.timeBlock === tb ? t.accentBg : t.bgCard,
                color: form.timeBlock === tb ? t.accent : t.textSec,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}>{tb || 'Any'}</button>
            ))}
          </div>
        </div>

        <Input label="Estimated minutes (optional)" value={form.estimatedMinutes}
          onChange={v => setForm(f => ({...f, estimatedMinutes: v}))} type="number" placeholder="30" />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={save} disabled={!form.title.trim()} style={{ flex: 2 }}>Save</Button>
        </div>

        <button onClick={onDelete} style={{
          width: '100%', padding: '11px', borderRadius: 12, marginTop: 12,
          border: `1px solid ${t.border}`, background: t.bgCard,
          color: t.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>🗑 Remove action</button>
      </div>
    </div>
  );
}
