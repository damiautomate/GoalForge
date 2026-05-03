import { useEffect, useState } from 'react';
import { auth, db, doc, getDoc } from '../lib/firebase';
import { useTheme, Card, Button, SectionHeader, PageTitle } from '../lib/theme';
import ProfileEnrichmentSetup from './ProfileEnrichmentSetup';

const LABELS = {
  careerLevel: 'Career level',
  lifeStage: 'Life stage',
  incomeTier: 'Monthly earnings tier',
  achievements: 'Past wins',
  certifications: 'Certifications',
  hoursPerDay: 'Hours/day',
  bestTimeOfDay: 'Best time of day',
  focusStyle: 'Focus style',
  notes: 'Notes for AI coach',
};

export default function ProfilePage() {
  const t = useTheme();
  const user = auth.currentUser;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setData(snap.data().profileEnrichment || {});
      else setData({});
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textTer }}>Loading...</div>;

  if (editing) {
    return (
      <ProfileEnrichmentSetup
        initial={data}
        editMode
        onComplete={() => { setEditing(false); reload(); }}
        onSkip={() => setEditing(false)}
      />
    );
  }

  const empty = !data || Object.keys(data).length === 0
    || Object.values(data).every(v => v === '' || v == null);

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <div style={{ padding: '28px 0 22px' }}>
        <SectionHeader label="About you"/>
        <PageTitle>Your profile</PageTitle>
        <p style={{ fontSize: 13, color: t.textSec, margin: '6px 0 0', lineHeight: 1.5 }}>
          What your AI coach knows about you. Update this anytime to recalibrate the advice you get.
        </p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
          Account
        </p>
        <Row label="Name" value={user?.displayName}/>
        <Row label="Email" value={user?.email}/>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
          Coach context
        </p>
        {empty ? (
          <p style={{ fontSize: 13, color: t.textSec, margin: 0, lineHeight: 1.5 }}>
            You haven't filled in profile context yet. Add it so the AI can speak to your level and patterns.
          </p>
        ) : (
          <>
            {Object.entries(LABELS).map(([k, label]) => {
              const v = data[k];
              if (v === '' || v == null) return null;
              return <Row key={k} label={label} value={String(v)}/>;
            })}
          </>
        )}
      </Card>

      <Button onClick={() => setEditing(true)}>{empty ? 'Fill in profile' : 'Edit profile'}</Button>
    </div>
  );

  function Row({ label, value }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '8px 0', borderBottom: `1px solid ${t.borderLt}`, gap: 12,
      }}>
        <span style={{ fontSize: 12, color: t.textSec, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: t.text, fontWeight: 500, textAlign: 'right' }}>
          {value || '—'}
        </span>
      </div>
    );
  }
}
