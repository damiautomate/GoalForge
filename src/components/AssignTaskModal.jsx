import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { useTheme, Card, Button, Input, Badge } from '../lib/theme';
import { createAssignedTask, getDirectDownline, getAllDownlineUids } from '../lib/team';

export default function AssignTaskModal({ teamId, onClose, onCreated }) {
  const t = useTheme();
  const uid = auth.currentUser?.uid;
  const userName = auth.currentUser?.displayName;

  const [form, setForm] = useState({
    description: '',
    type: 'one_time',
    deadline: '',
    proofRequired: false,
    proofType: 'text',
    fineAmount: 200,
    scope: 'direct',
  });
  const [downline, setDownline] = useState([]);
  const [allDownline, setAllDownline] = useState([]);
  const [specific, setSpecific] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1); // 1 = details, 2 = scope/fine

  useEffect(() => {
    (async () => {
      const direct = await getDirectDownline(uid);
      const allUids = await getAllDownlineUids(uid);
      setDownline(direct);
      setAllDownline(allUids);
    })();
  }, [uid]);

  function toggleSpecific(id) {
    setSpecific(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExcluded(id) {
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!form.description.trim()) return;
    setCreating(true);
    try {
      await createAssignedTask({
        teamId,
        assignedBy: uid,
        assignedByName: userName,
        description: form.description,
        type: form.type,
        recurrencePattern: form.type === 'recurring' ? 'daily' : null,
        deadline: form.deadline || null,
        proofRequired: form.proofRequired,
        proofType: form.proofType,
        fineAmount: parseInt(form.fineAmount) || 200,
        scope: form.scope,
        specificMembers: form.scope === 'specific' ? Array.from(specific) : [],
        excludedFromFines: Array.from(excluded),
      });
      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert('Failed to create task: ' + e.message);
    }
    setCreating(false);
  }

  // Determine target count
  let targetCount = 0;
  if (form.scope === 'direct') targetCount = downline.length;
  else if (form.scope === 'tree') targetCount = allDownline.length;
  else if (form.scope === 'specific') targetCount = specific.size;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, width: "100%", maxWidth: 480, maxHeight: "90vh",
        borderRadius: "20px 20px 0 0", padding: "20px 20px 28px",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>
            Assign Task — Step {step}/2
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 24,
            color: t.textTer, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: t.accent }}/>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: step >= 2 ? t.accent : t.bgSurface }}/>
        </div>

        {step === 1 && (
          <>
            <Input label="Task description" value={form.description}
              onChange={v => setForm(f => ({...f, description: v}))}
              textarea rows={2}
              placeholder="e.g. Post 3 promotional videos this week"/>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 8 }}>Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {['one_time', 'recurring'].map(tt => (
                  <button key={tt} onClick={() => setForm(f => ({...f, type: tt}))} style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    border: `1px solid ${form.type === tt ? t.accentBorder : t.border}`,
                    background: form.type === tt ? t.accentBg : t.bgCard,
                    color: form.type === tt ? t.accent : t.textSec,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>{tt === 'one_time' ? '📅 One-time' : '🔁 Recurring'}</button>
                ))}
              </div>
            </div>

            <Input label="Deadline" value={form.deadline}
              onChange={v => setForm(f => ({...f, deadline: v}))}
              type="date"/>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <button onClick={() => setForm(f => ({...f, proofRequired: !f.proofRequired}))} style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: form.proofRequired ? t.accent : "transparent",
                  border: `2px solid ${form.proofRequired ? t.accent : t.border}`,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                }}>{form.proofRequired ? "✓" : ""}</button>
                <span style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>Require proof of completion</span>
              </label>
              {form.proofRequired && (
                <div style={{ marginTop: 10, marginLeft: 32 }}>
                  <select value={form.proofType} onChange={e => setForm(f => ({...f, proofType: e.target.value}))}
                    style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: "inherit" }}>
                    <option value="text">Text confirmation</option>
                    <option value="link">Link/URL</option>
                    <option value="screenshot">Screenshot URL</option>
                  </select>
                </div>
              )}
            </div>

            <Button onClick={() => setStep(2)} disabled={!form.description.trim()}>Next: Choose recipients</Button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 8 }}>Who gets this task?</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { v: 'direct', l: `Direct downline (${downline.length})`, d: 'People you directly recruited' },
                  { v: 'tree', l: `Entire tree (${allDownline.length})`, d: 'You + all your downline + their downlines' },
                  { v: 'specific', l: 'Specific members', d: 'Pick individual people' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setForm(f => ({...f, scope: opt.v}))} style={{
                    padding: "12px 14px", borderRadius: 10, textAlign: "left",
                    border: `1px solid ${form.scope === opt.v ? t.accentBorder : t.border}`,
                    background: form.scope === opt.v ? t.accentBg : t.bgCard,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: form.scope === opt.v ? t.accent : t.text, margin: 0 }}>{opt.l}</p>
                    <p style={{ fontSize: 11, color: t.textTer, margin: "2px 0 0" }}>{opt.d}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Specific members selector */}
            {form.scope === 'specific' && (
              <Card style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "0 0 10px" }}>Select members</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                  {downline.map(m => (
                    <div key={m.uid} onClick={() => toggleSpecific(m.uid)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: specific.has(m.uid) ? t.accentBg : "transparent",
                      cursor: "pointer",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5,
                        background: specific.has(m.uid) ? t.accent : "transparent",
                        border: `1.5px solid ${specific.has(m.uid) ? t.accent : t.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 10, fontWeight: 700,
                      }}>{specific.has(m.uid) ? "✓" : ""}</div>
                      <span style={{ fontSize: 13, color: t.text }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Fine per miss (₦)" value={form.fineAmount}
                onChange={v => setForm(f => ({...f, fineAmount: v}))} type="number"/>
              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 16 }}>
                <div style={{
                  padding: "11px 14px", borderRadius: 12, background: t.bgSurface,
                  width: "100%", textAlign: "center",
                }}>
                  <p style={{ fontSize: 11, color: t.textTer, margin: "0 0 2px" }}>Will assign to</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif", margin: 0 }}>
                    {targetCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Exempt members from fines */}
            {targetCount > 0 && (
              <Card style={{ marginBottom: 16, background: t.bgSurface }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "0 0 8px" }}>
                  Exempt from fines (optional)
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
                  {downline.map(m => (
                    <label key={m.uid} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.text, cursor: "pointer" }}>
                      <input type="checkbox" checked={excluded.has(m.uid)}
                        onChange={() => toggleExcluded(m.uid)}/>
                      {m.name}
                    </label>
                  ))}
                </div>
              </Card>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</Button>
              <Button onClick={handleCreate} disabled={creating || targetCount === 0} style={{ flex: 2 }}>
                {creating ? 'Creating...' : `Assign to ${targetCount} member${targetCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
