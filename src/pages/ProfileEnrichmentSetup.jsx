import { useState } from 'react';
import { auth, db, doc, updateDoc, serverTimestamp } from '../lib/firebase';
import { useTheme, Card, Input, Button, SectionHeader, PageTitle } from '../lib/theme';

const STEPS = [
  { key: 'level',       title: 'Where you are',           icon: '🪜' },
  { key: 'achievements',title: 'What you\'ve done',       icon: '🏆' },
  { key: 'productivity',title: 'How you work',            icon: '⚡' },
  { key: 'notes',       title: 'Anything else?',          icon: '📝' },
];

const CAREER_LEVELS = [
  { v: 'beginner', l: 'Beginner', d: '< 1 year experience or just starting out' },
  { v: 'intermediate', l: 'Intermediate', d: '1-3 years, some real wins under your belt' },
  { v: 'expert', l: 'Expert', d: '3+ years, regularly delivering at a high level' },
];
const LIFE_STAGES = [
  { v: 'student', l: 'Student' },
  { v: 'working', l: 'Working full-time' },
  { v: 'side_hustle', l: 'Side hustle / part-time' },
  { v: 'entrepreneur', l: 'Full-time entrepreneur' },
  { v: 'between', l: 'Between things' },
];
const INCOME_TIERS = [
  { v: 'pre', l: 'Not earning yet' },
  { v: 'lt500', l: 'Under $500/mo' },
  { v: '500_2k', l: '$500 - $2k/mo' },
  { v: '2k_5k', l: '$2k - $5k/mo' },
  { v: '5k_10k', l: '$5k - $10k/mo' },
  { v: 'gt10k', l: '$10k+/mo' },
];
const TIME_OF_DAY = ['Early morning (5-8am)', 'Morning (8-12)', 'Afternoon (12-5)', 'Evening (5-9pm)', 'Late night (9pm+)'];
const FOCUS_STYLES = [
  { v: 'deep_blocks', l: 'Long deep-work blocks (90+ min)' },
  { v: 'pomodoro', l: 'Short sprints with breaks' },
  { v: 'opportunistic', l: 'Whenever I can grab time' },
  { v: 'scheduled', l: 'Strict calendar blocks' },
];

// One-time post-signup setup. Shown before YearlyPlanSetup.
// Also reusable as an edit page (pass `initial` + `editMode`).
// Fields are saved to users/{uid}.profileEnrichment + hasEnrichedProfile = true.
export default function ProfileEnrichmentSetup({ onComplete, onSkip, initial, editMode }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(() => ({
    careerLevel: initial?.careerLevel || '',
    lifeStage: initial?.lifeStage || '',
    incomeTier: initial?.incomeTier || '',
    achievements: initial?.achievements || '',
    certifications: initial?.certifications || '',
    hoursPerDay: initial?.hoursPerDay != null ? String(initial.hoursPerDay) : '',
    bestTimeOfDay: initial?.bestTimeOfDay || '',
    focusStyle: initial?.focusStyle || '',
    notes: initial?.notes || '',
  }));

  const set = (key) => (val) => setData(prev => ({ ...prev, [key]: val }));
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function save() {
    setSaving(true);
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, 'users', uid), {
        profileEnrichment: {
          ...data,
          hoursPerDay: parseFloat(data.hoursPerDay) || null,
          completedAt: serverTimestamp(),
        },
        hasEnrichedProfile: true,
      });
      onComplete?.();
    } catch (e) {
      console.error(e);
      alert('Save failed: ' + (e.message || ''));
    }
    setSaving(false);
  }

  async function skipForNow() {
    setSaving(true);
    try {
      const uid = auth.currentUser.uid;
      // Mark skipped so we don't re-prompt every login. They can fill it in via More tab later.
      await updateDoc(doc(db, 'users', uid), { hasEnrichedProfile: 'skipped' });
      onSkip?.();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  function renderStep() {
    switch (cur.key) {
      case 'level': return (
        <>
          <p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, margin: '0 0 16px' }}>
            Help your AI coach speak to you accurately. The more it knows, the more specific its advice becomes.
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSec, margin: '0 0 8px' }}>Career level</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {CAREER_LEVELS.map(lvl => (
              <button key={lvl.v} onClick={() => set('careerLevel')(lvl.v)} style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                border: `1px solid ${data.careerLevel === lvl.v ? t.accentBorder : t.border}`,
                background: data.careerLevel === lvl.v ? t.accentBg : t.bgCard,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: data.careerLevel === lvl.v ? t.accent : t.text, margin: 0 }}>{lvl.l}</p>
                <p style={{ fontSize: 11, color: t.textTer, margin: '2px 0 0' }}>{lvl.d}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSec, margin: '0 0 8px' }}>Life stage</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {LIFE_STAGES.map(s => (
              <button key={s.v} onClick={() => set('lifeStage')(s.v)} style={{
                padding: '8px 14px', borderRadius: 18, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${data.lifeStage === s.v ? t.accentBorder : t.border}`,
                background: data.lifeStage === s.v ? t.accentBg : t.bgCard,
                color: data.lifeStage === s.v ? t.accent : t.textSec, cursor: 'pointer',
              }}>{s.l}</button>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSec, margin: '0 0 8px' }}>Current monthly earnings</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {INCOME_TIERS.map(s => (
              <button key={s.v} onClick={() => set('incomeTier')(s.v)} style={{
                padding: '8px 14px', borderRadius: 18, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${data.incomeTier === s.v ? t.accentBorder : t.border}`,
                background: data.incomeTier === s.v ? t.accentBg : t.bgCard,
                color: data.incomeTier === s.v ? t.accent : t.textSec, cursor: 'pointer',
              }}>{s.l}</button>
            ))}
          </div>
        </>
      );

      case 'achievements': return (
        <>
          <p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, margin: '0 0 16px' }}>
            Past wins help the AI calibrate what's realistic for you and reference your strengths.
          </p>
          <Input label="Past wins" value={data.achievements} onChange={set('achievements')}
            textarea rows={5}
            placeholder={"e.g. First $1000 freelance month\nLanded 10 Fiverr clients\nFinished a 90-day fitness streak\nGraduated top of class"}/>
          <Input label="Certifications / training (optional)" value={data.certifications} onChange={set('certifications')}
            textarea rows={3}
            placeholder="e.g. Google Digital Marketing, ALX Software Engineering, ..."/>
        </>
      );

      case 'productivity': return (
        <>
          <p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, margin: '0 0 16px' }}>
            How you actually work — so daily plans don't fight your patterns.
          </p>
          <Input label="Hours per day you can commit" value={data.hoursPerDay} onChange={set('hoursPerDay')}
            type="number" placeholder="e.g. 4"/>

          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSec, margin: '0 0 8px' }}>Best time of day</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {TIME_OF_DAY.map(s => (
              <button key={s} onClick={() => set('bestTimeOfDay')(s)} style={{
                padding: '8px 14px', borderRadius: 18, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${data.bestTimeOfDay === s ? t.accentBorder : t.border}`,
                background: data.bestTimeOfDay === s ? t.accentBg : t.bgCard,
                color: data.bestTimeOfDay === s ? t.accent : t.textSec, cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSec, margin: '0 0 8px' }}>Focus style</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FOCUS_STYLES.map(s => (
              <button key={s.v} onClick={() => set('focusStyle')(s.v)} style={{
                padding: '10px 14px', borderRadius: 12, textAlign: 'left',
                border: `1px solid ${data.focusStyle === s.v ? t.accentBorder : t.border}`,
                background: data.focusStyle === s.v ? t.accentBg : t.bgCard,
                color: data.focusStyle === s.v ? t.accent : t.text,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{s.l}</button>
            ))}
          </div>
        </>
      );

      case 'notes': return (
        <>
          <p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, margin: '0 0 16px' }}>
            Tell the AI anything else it should know about you — context, blockers, what motivates you. Free-form, anything goes.
          </p>
          <Input label="Notes for your AI coach (optional)" value={data.notes} onChange={set('notes')}
            textarea rows={6}
            placeholder={"e.g. I have a 9-5 so I work best after 7pm. Network marketing is harder for me than freelancing — I get drained. Money is for paying off student loans this year."}/>
          <Card bg={t.successBg} border={t.successBdr}>
            <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: 0 }}>
              You can always update this from More → Profile. Next, we'll set up your yearly plan.
            </p>
          </Card>
        </>
      );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, padding: '0 20px 40px' }}>
      <div style={{ padding: '28px 0 6px' }}>
        <SectionHeader label={`Account setup · Step ${step + 1} of ${STEPS.length}`} color={t.accent}/>
        <PageTitle>{cur.icon} {cur.title}</PageTitle>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? t.accent : t.bgSurface,
          }}/>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>{renderStep()}</div>

      <div style={{ display: 'flex', gap: 10 }}>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>← Back</Button>
        )}
        {isLast ? (
          <Button onClick={save} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving...' : (editMode ? 'Save changes' : 'Continue to yearly plan →')}
          </Button>
        ) : (
          <Button onClick={() => setStep(step + 1)} style={{ flex: step > 0 ? 2 : 1 }}>Continue →</Button>
        )}
      </div>

      {!editMode && (
        <button onClick={skipForNow} disabled={saving} style={{
          width: '100%', padding: '12px', marginTop: 16,
          background: 'none', border: 'none', color: t.textTer,
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>Skip for now — I'll fill this in later</button>
      )}
      {editMode && onSkip && (
        <button onClick={onSkip} disabled={saving} style={{
          width: '100%', padding: '12px', marginTop: 16,
          background: 'none', border: 'none', color: t.textTer,
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      )}
    </div>
  );
}
