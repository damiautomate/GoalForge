import { useState } from 'react';
import { useTheme, Button, Input } from '../lib/theme';
import { PREDEFINED_GOALS } from '../lib/goalLibrary';

// Two-step modal: pick a predefined goal -> fill its specific schema -> add it.
// Falls back to a generic "custom goal" form if user picks "Custom".
export default function GoalLibraryModal({ onClose, onAdd }) {
  const t = useTheme();
  const [picked, setPicked] = useState(null); // predefined goal config OR 'custom'
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  // Custom-goal state
  const [custom, setCustom] = useState({
    title: '', type: 'target', target: '', unit: '', category: '', icon: '🎯',
  });

  function pick(goal) {
    setPicked(goal);
    const initial = {};
    for (const f of goal.fields) {
      initial[f.key] = f.defaultValue ?? '';
    }
    setValues(initial);
  }

  async function addPredefined() {
    if (!picked) return;
    // Validate required fields
    for (const f of picked.fields) {
      if (f.required && !String(values[f.key] || '').trim()) {
        alert(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      const built = picked.apply(values, picked);
      await onAdd({ ...built, source: 'library', libraryId: picked.id });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to add: ' + (e.message || 'unknown'));
    }
    setSaving(false);
  }

  async function addCustom() {
    if (!custom.title.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        title: custom.title.trim(),
        type: custom.type,
        target: custom.type === 'checklist' ? 1 : (parseFloat(custom.target) || 0),
        unit: custom.unit,
        category: custom.category,
        icon: custom.icon,
        source: 'custom',
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to add: ' + (e.message || 'unknown'));
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
            {picked ? (picked === 'custom' ? 'Custom goal' : picked.title) : 'Add a goal'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 24, color: t.textTer, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Step 1: list */}
        {!picked && (
          <>
            <p style={{ fontSize: 12, color: t.textSec, margin: '0 0 12px' }}>
              Pick a goal — each one asks the right questions for that kind of goal.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PREDEFINED_GOALS.map(g => (
                <button key={g.id} onClick={() => pick(g)} style={{
                  display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left',
                  padding: '12px 14px', borderRadius: 12,
                  border: `1px solid ${t.border}`, background: t.bgCard,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <span style={{ fontSize: 22 }}>{g.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>{g.title}</p>
                    <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>{g.description}</p>
                  </div>
                  <span style={{ color: t.accent, fontSize: 18 }}>›</span>
                </button>
              ))}
              <button onClick={() => setPicked('custom')} style={{
                display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left',
                padding: '12px 14px', borderRadius: 12,
                border: `1.5px dashed ${t.border}`, background: t.bgCard,
                cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
              }}>
                <span style={{ fontSize: 22 }}>✏️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>Custom goal</p>
                  <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>Define everything yourself.</p>
                </div>
                <span style={{ color: t.accent, fontSize: 18 }}>›</span>
              </button>
            </div>
          </>
        )}

        {/* Step 2a: predefined fields */}
        {picked && picked !== 'custom' && (
          <>
            <p style={{ fontSize: 12, color: t.textSec, margin: '0 0 14px' }}>{picked.description}</p>
            {picked.fields.map(f => (
              <FieldRenderer key={f.key} field={f} value={values[f.key] || ''}
                onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))} />
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setPicked(null)} style={{ flex: 1 }}>Back</Button>
              <Button onClick={addPredefined} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Adding...' : 'Add goal'}
              </Button>
            </div>
          </>
        )}

        {/* Step 2b: custom */}
        {picked === 'custom' && (
          <>
            <Input label="Title" value={custom.title} onChange={v => setCustom(c => ({...c, title: v}))} placeholder="What do you want to achieve?"/>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Type</label>
              <select value={custom.type} onChange={e => setCustom(c => ({...c, type: e.target.value}))}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit' }}>
                <option value="target">Target</option>
                <option value="measurable">Measurable</option>
                <option value="habit">Habit</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
            <Input label="Category" value={custom.category} onChange={v => setCustom(c => ({...c, category: v}))} placeholder="e.g. Freelancing"/>
            {custom.type !== 'checklist' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Target value" value={custom.target} onChange={v => setCustom(c => ({...c, target: v}))} type="number" placeholder="e.g. 1000"/>
                <Input label="Unit" value={custom.unit} onChange={v => setCustom(c => ({...c, unit: v}))} placeholder="$, pages, days"/>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setPicked(null)} style={{ flex: 1 }}>Back</Button>
              <Button onClick={addCustom} disabled={saving || !custom.title.trim()} style={{ flex: 2 }}>
                {saving ? 'Adding...' : 'Add goal'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const t = useTheme();
  if (field.type === 'textarea' || field.type === 'checklistItems') {
    return (
      <Input label={field.label + (field.optional ? ' (optional)' : '')}
        value={value} onChange={onChange}
        textarea rows={field.type === 'checklistItems' ? 5 : 3}
        placeholder={field.placeholder} />
    );
  }
  if (field.type === 'number' || field.type === 'currency') {
    return (
      <Input label={field.label + (field.optional ? ' (optional)' : '')}
        value={value} onChange={onChange}
        type="number" placeholder={field.placeholder} />
    );
  }
  return (
    <Input label={field.label + (field.optional ? ' (optional)' : '')}
      value={value} onChange={onChange}
      placeholder={field.placeholder} />
  );
}
