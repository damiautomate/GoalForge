// Earnings logging — users log money earned this month per source.
// Stored at: earnings/{uid}/{ym}/{entryId}
import { db, doc, setDoc, deleteDoc, getDocs, collection, serverTimestamp } from './firebase';

export async function addEarningEntry(uid, ym, { amount, source, note, currency = 'USD' }) {
  const id = `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    amount: parseFloat(amount) || 0,
    source: source || 'Other',
    note: note || '',
    currency,
    date: new Date().toISOString(),
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'earnings', uid, ym, id), entry);
  return { id, ...entry };
}

export async function listEarningEntries(uid, ym) {
  const snap = await getDocs(collection(db, 'earnings', uid, ym));
  const entries = [];
  snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
  return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function deleteEarningEntry(uid, ym, id) {
  await deleteDoc(doc(db, 'earnings', uid, ym, id));
}

export async function getMonthlyEarnings(uid, ym) {
  const entries = await listEarningEntries(uid, ym);
  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const bySource = {};
  for (const e of entries) {
    bySource[e.source] = (bySource[e.source] || 0) + (e.amount || 0);
  }
  return { total, bySource, entries };
}
