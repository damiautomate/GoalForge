import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { useTheme, Card, Button, Input, ProgressBar, SectionHeader, pct } from '../lib/theme';
import { addEarningEntry, listEarningEntries, deleteEarningEntry } from '../lib/earnings';

const SOURCES = ['Freelancing', 'Network Marketing', 'Salary', 'Side hustle', 'Investment', 'Other'];

// Dashboard widget — show monthly earnings vs the user's monthly income target.
// User can log new entries. Leaders see aggregated highest-earner via team page.
export default function EarningsCard({ monthlyTarget }) {
  const t = useTheme();
  const uid = auth.currentUser?.uid;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const [entries, setEntries] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ amount: '', source: SOURCES[0], note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => setEntries(await listEarningEntries(uid, ym)))(); }, [uid, ym]);

  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const target = parseFloat(monthlyTarget) || 0;
  const v = target ? pct(total, target) : 0;

  async function save() {
    if (!form.amount) return;
    setSaving(true);
    try {
      const newEntry = await addEarningEntry(uid, ym, form);
      setEntries(prev => [newEntry, ...prev]);
      setForm({ amount: '', source: SOURCES[0], note: '' });
      setShowLog(false);
    } catch (e) {
      console.error(e);
      alert('Failed to log: ' + (e.message || ''));
    }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteEarningEntry(uid, ym, id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) { console.error(e); }
  }

  return (
    <Card bg={t.successBg} border={t.successBdr} style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <SectionHeader label={`${now.toLocaleString('en', { month: 'long' })} earnings`} color={t.success}/>
          <p style={{ fontSize: 28, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", margin: '4px 0 0', lineHeight: 1.1 }}>
            ${total.toLocaleString()}
            {target > 0 && (
              <span style={{ fontSize: 14, color: t.textTer, fontWeight: 400, fontFamily: "'DM Sans'" }}> / ${target.toLocaleString()}</span>
            )}
          </p>
          <p style={{ fontSize: 11, color: t.textTer, margin: '4px 0 0' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} this month
          </p>
        </div>
        <button onClick={() => setShowLog(true)} style={{
          background: t.success, color: '#fff', border: 'none',
          borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Log</button>
      </div>

      {target > 0 && <ProgressBar value={v} color={t.success}/>}

      {entries.length > 0 && (
        <button onClick={() => setShowHistory(s => !s)} style={{
          background: 'none', border: 'none', color: t.textSec, fontSize: 11,
          fontWeight: 600, cursor: 'pointer', padding: '8px 0 0', fontFamily: 'inherit',
        }}>
          {showHistory ? '▾ Hide entries' : '▸ Show entries'}
        </button>
      )}

      {showHistory && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(e => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: t.bgCard, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${t.border}`,
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>${(e.amount || 0).toLocaleString()}</p>
                <p style={{ fontSize: 10, color: t.textTer, margin: '1px 0 0' }}>
                  {e.source}{e.note ? ` · ${e.note}` : ''} · {new Date(e.date).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => remove(e.id)} style={{
                background: 'none', border: 'none', color: t.textTer, cursor: 'pointer', fontSize: 16,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {showLog && (
        <div onClick={() => setShowLog(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.bg, width: '100%', maxWidth: 480,
            borderRadius: '20px 20px 0 0', padding: '20px 20px 28px',
          }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: t.text, margin: '0 0 12px' }}>
              Log earnings
            </h2>
            <Input label="Amount ($)" value={form.amount} onChange={v => setForm(f => ({...f, amount: v}))} type="number" placeholder="500"/>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>Source</label>
              <select value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 14, fontFamily: 'inherit' }}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input label="Note (optional)" value={form.note} onChange={v => setForm(f => ({...f, note: v}))} placeholder="Client name, project, etc."/>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowLog(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.amount} style={{ flex: 2 }}>
                {saving ? 'Saving...' : 'Log entry'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
