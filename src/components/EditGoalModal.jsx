import { useState } from 'react';
import { useTheme, Card, Button, Input } from '../lib/theme';

const ICONS = ['🎯','💼','📚','👥','📱','🌐','📤','💰','🔥','📊','🏋️','✍️','🎓','🛠️','🤝','⭐','🎧'];
const TYPES = [
  { v: 'target', l: 'Target', d: 'Hit a number' },
  { v: 'measurable', l: 'Measurable', d: 'Track progress' },
  { v: 'habit', l: 'Habit', d: 'Consistency %' },
  { v: 'checklist', l: 'Checklist', d: 'Done / not done' },
];

// Edit existing goal — full edit including title, target, unit, category, icon, type.
// Preserves `current` value unless `unit` changes.
export default function EditGoalModal({ goal, onClose, onSave, onDelete }) {
  const t = useTheme();
  const [form, setForm] = useState({
    title: goal.title || '',
    type: goal.type || 'target',
    target: goal.target ?? '',
    unit: goal.unit || '',
    category: goal.category || '',
    icon: goal.icon || '🎯',
    current: goal.current ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const unitChanged = (form.unit || '') !== (goal.unit || '');
  const typeChanged = form.type !== goal.type;

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const updates = {
        title: form.title.trim(),
        type: form.type,
        unit: form.unit,
        category: form.category,
        icon: form.icon,
        target: form.type === 'checklist' ? (parseInt(form.target) || 1) : (parseFloat(form.target) || 0),
      };
      // Preserve existing current value unless the unit changed
      // (since "200 pages" -> "200 dollars" makes no sense). Type change
      // also resets, since checklist uses a different shape.
      if (unitChanged || typeChanged) {
        updates.current = 0;
      } else {
        updates.current = parseFloat(form.current) || 0;
      }
      await onSave(updates);
    } catch (e) {
      console.error(e);
      alert('Save failed: ' + (e.message || 'unknown'));
    }
    setSaving(false);
  }

  async function del() {
    setSaving(true);
    try {
      await onDelete();
    } catch (e) {
      console.error(e);
      alert('Delete failed: ' + (e.message || 'unknown'));
    }
    setSaving(false);
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
            Edit goal
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 24, color: t.textTer, cursor: 'pointer',
          }}>×</button>
        </div>

        <Input label="Title" value={form.title} onChange={v => setForm(f => ({...f, title: v}))} placeholder="What are you tracking?" />

        {/* Icon picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setForm(f => ({...f, icon: ic}))} style={{
                width: 36, height: 36, borderRadius: 10,
                border: `1px solid ${form.icon === ic ? t.accentBorder : t.border}`,
                background: form.icon === ic ? t.accentBg : t.bgCard,
                fontSize: 18, cursor: 'pointer',
              }}>{ic}</button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TYPES.map(tt => (
              <button key={tt.v} onClick={() => setForm(f => ({...f, type: tt.v}))} style={{
                flex: '1 1 45%', padding: '9px 10px', borderRadius: 10,
                border: `1px solid ${form.type === tt.v ? t.accentBorder : t.border}`,
                background: form.type === tt.v ? t.accentBg : t.bgCard,
                color: form.type === tt.v ? t.accent : t.text,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{tt.l}</p>
                <p style={{ fontSize: 10, margin: '2px 0 0', color: t.textTer }}>{tt.d}</p>
              </button>
            ))}
          </div>
        </div>

        <Input label="Category" value={form.category} onChange={v => setForm(f => ({...f, category: v}))} placeholder="e.g. Freelancing" />

        {form.type !== 'checklist' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Target" value={form.target} onChange={v => setForm(f => ({...f, target: v}))} type="number" placeholder="e.g. 1000"/>
            <Input label="Unit" value={form.unit} onChange={v => setForm(f => ({...f, unit: v}))} placeholder="$, pages, days"/>
          </div>
        )}

        {form.type !== 'checklist' && !unitChanged && !typeChanged && (
          <Input label="Current progress" value={form.current} onChange={v => setForm(f => ({...f, current: v}))} type="number" placeholder="0"/>
        )}

        {(unitChanged || typeChanged) && (
          <div style={{
            background: t.dangerBg, color: t.danger, fontSize: 12, lineHeight: 1.5,
            padding: '10px 12px', borderRadius: 10, marginBottom: 14,
          }}>
            Heads up: changing the {unitChanged ? 'unit' : 'type'} will reset progress to 0, since the old measurement no longer makes sense.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()} style={{ flex: 2 }}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} style={{
              width: '100%', padding: '11px', borderRadius: 12,
              border: `1px solid ${t.border}`, background: t.bgCard,
              color: t.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>🗑 Delete this goal</button>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: t.text, margin: '0 0 10px' }}>
                Delete this goal? Progress will be lost.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setConfirmDel(false)} style={{ flex: 1 }}>Keep</Button>
                <Button variant="danger" onClick={del} disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
