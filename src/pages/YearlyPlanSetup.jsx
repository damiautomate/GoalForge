import { useState } from 'react';
import { auth, db, doc, setDoc, updateDoc, serverTimestamp } from '../lib/firebase';
import { useTheme, Input, Button, Card, SectionHeader, PageTitle } from '../lib/theme';

const STEPS = [
  { key: "identity", title: "Identity & Vision", icon: "🌟" },
  { key: "income", title: "Income Goals", icon: "💰" },
  { key: "nm", title: "Network Marketing", icon: "👥" },
  { key: "freelance", title: "Freelancing", icon: "💼" },
  { key: "growth", title: "Personal Development", icon: "📚" },
  { key: "daily", title: "Daily Structure", icon: "⚡" },
  { key: "commit", title: "Commitment", icon: "🤝" },
];

const INITIAL = {
  wordOfYear: '', vision: '', motivation: '',
  incomeTotal: '', incomeMin: '', incomeRealistic: '', incomeDream: '',
  nmCurrentSize: '', nmTargetSize: '', nmCurrentRank: '', nmTargetRank: '',
  nmRecruitPace: '', nmIncomeGoal: '', nmQ1: '', nmQ2: '', nmQ3: '', nmQ4: '', nmWhy: '',
  frPlatforms: '', frSkills: '', frIncomeGoal: '', frProjectsPace: '',
  frAvgPerProject: '', frReviewTarget: '', frWhy: '',
  pdGoal: '', pdBooks: '', pdCourses: '', pdEvents: '', pdWhy: '',
  gamePlan: '', habitLock: '', dailyIPAs: '', dailyWhy: '',
  reviewDay: '15', accountabilityPartner: '', monthlyReview: true,
};

export default function YearlyPlanSetup({ onComplete }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  const set = (key) => (val) => setData(prev => ({ ...prev, [key]: val }));
  const cur = STEPS[step];

  async function handleSave() {
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const uid = auth.currentUser.uid;
      const monthlyTarget = data.incomeTotal ? Math.round(parseFloat(data.incomeTotal) / 12) : 0;
      const weeklyTarget = data.incomeTotal ? Math.round(parseFloat(data.incomeTotal) / 52) : 0;

      await setDoc(doc(db, 'yearlyPlans', uid, String(year), 'plan'), {
        wordOfYear: data.wordOfYear,
        vision: data.vision,
        motivation: data.motivation,
        income: {
          total: parseFloat(data.incomeTotal) || 0,
          minimum: parseFloat(data.incomeMin) || 0,
          realistic: parseFloat(data.incomeRealistic) || 0,
          dream: parseFloat(data.incomeDream) || 0,
          monthlyTarget, weeklyTarget,
        },
        networkMarketing: {
          currentTeamSize: parseInt(data.nmCurrentSize) || 0,
          targetTeamSize: parseInt(data.nmTargetSize) || 0,
          currentRank: data.nmCurrentRank,
          targetRank: data.nmTargetRank,
          recruitmentPace: data.nmRecruitPace,
          incomeGoal: data.nmIncomeGoal,
          quarterlyRanks: { q1: data.nmQ1, q2: data.nmQ2, q3: data.nmQ3, q4: data.nmQ4 },
          why: data.nmWhy,
        },
        freelancing: {
          platforms: data.frPlatforms, skills: data.frSkills,
          incomeGoal: data.frIncomeGoal, projectsPace: data.frProjectsPace,
          avgPerProject: data.frAvgPerProject, reviewTarget: data.frReviewTarget,
          why: data.frWhy,
        },
        personalDev: {
          goal: data.pdGoal,
          books: data.pdBooks.split('\n').map(b => b.trim()).filter(Boolean),
          courses: data.pdCourses, events: data.pdEvents, why: data.pdWhy,
        },
        dailyStructure: {
          gamePlan: data.gamePlan, habitLock: data.habitLock,
          dailyIPAs: data.dailyIPAs.split('\n').map(i => i.trim()).filter(Boolean),
          why: data.dailyWhy,
        },
        commitment: {
          reviewDay: parseInt(data.reviewDay) || 15,
          accountabilityPartner: data.accountabilityPartner,
          monthlyReview: data.monthlyReview,
        },
        createdAt: serverTimestamp(),
        year,
      });

      await updateDoc(doc(db, 'users', uid), { hasYearlyPlan: true });
      onComplete?.();
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  }

  function renderStep() {
    switch (cur.key) {
      case 'identity': return (<>
        <Input label="Word of the Year" value={data.wordOfYear} onChange={set('wordOfYear')} placeholder="e.g. Focus, Growth, Discipline"/>
        <Input label="Annual Vision" value={data.vision} onChange={set('vision')} textarea rows={5}
          placeholder="What do you want to achieve this year? Who do you want to become? Write freely — this is your north star."/>
        <Input label="Motivation" value={data.motivation} onChange={set('motivation')} textarea rows={3}
          placeholder="Why do these goals matter to you? What's driving you?"/>
      </>);

      case 'income': return (<>
        <Input label="Total Income Goal ($)" value={data.incomeTotal} onChange={set('incomeTotal')} type="number" placeholder="e.g. 10000"/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Input label="Minimum ($)" value={data.incomeMin} onChange={set('incomeMin')} type="number" placeholder="5000"/>
          <Input label="Realistic ($)" value={data.incomeRealistic} onChange={set('incomeRealistic')} type="number" placeholder="10000"/>
          <Input label="Dream ($)" value={data.incomeDream} onChange={set('incomeDream')} type="number" placeholder="20000"/>
        </div>
        {data.incomeTotal && (
          <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif" }}>
                  ${Math.round(parseFloat(data.incomeTotal) / 12).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: t.textTer }}>Monthly target</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif" }}>
                  ${Math.round(parseFloat(data.incomeTotal) / 52).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: t.textTer }}>Weekly target</div>
              </div>
            </div>
          </Card>
        )}
      </>);

      case 'nm': return (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Current team size" value={data.nmCurrentSize} onChange={set('nmCurrentSize')} type="number" placeholder="1"/>
          <Input label="Target team size" value={data.nmTargetSize} onChange={set('nmTargetSize')} type="number" placeholder="30"/>
          <Input label="Current rank" value={data.nmCurrentRank} onChange={set('nmCurrentRank')} placeholder="Member"/>
          <Input label="Target rank" value={data.nmTargetRank} onChange={set('nmTargetRank')} placeholder="Director"/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Recruitment pace" value={data.nmRecruitPace} onChange={set('nmRecruitPace')} placeholder="3/month"/>
          <Input label="Income goal" value={data.nmIncomeGoal} onChange={set('nmIncomeGoal')} placeholder="₦5,000,000"/>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "4px 0 8px" }}>Quarterly rank milestones</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <Input label="Q1" value={data.nmQ1} onChange={set('nmQ1')} placeholder="Manager"/>
          <Input label="Q2" value={data.nmQ2} onChange={set('nmQ2')} placeholder="Sr Mgr"/>
          <Input label="Q3" value={data.nmQ3} onChange={set('nmQ3')} placeholder="Exec Mgr"/>
          <Input label="Q4" value={data.nmQ4} onChange={set('nmQ4')} placeholder="Director"/>
        </div>
        <Input label="Why is this important?" value={data.nmWhy} onChange={set('nmWhy')} textarea rows={2}
          placeholder="Why network marketing? What does achieving this mean for you?"/>
      </>);

      case 'freelance': return (<>
        <Input label="Platforms" value={data.frPlatforms} onChange={set('frPlatforms')} placeholder="Fiverr, Upwork"/>
        <Input label="Skills / Services" value={data.frSkills} onChange={set('frSkills')} placeholder="Marketing Automation Specialist"/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Income goal ($)" value={data.frIncomeGoal} onChange={set('frIncomeGoal')} placeholder="20000"/>
          <Input label="Projects/month" value={data.frProjectsPace} onChange={set('frProjectsPace')} placeholder="3"/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Avg per project ($)" value={data.frAvgPerProject} onChange={set('frAvgPerProject')} placeholder="667"/>
          <Input label="5-star review target" value={data.frReviewTarget} onChange={set('frReviewTarget')} placeholder="40"/>
        </div>
        <Input label="Why?" value={data.frWhy} onChange={set('frWhy')} textarea rows={2}
          placeholder="What drives your freelancing goals?"/>
      </>);

      case 'growth': return (<>
        <Input label="Personal development goal" value={data.pdGoal} onChange={set('pdGoal')} textarea rows={2}
          placeholder="e.g. Build self-confidence, develop communication skills, build grit"/>
        <Input label="Books to read (one per line)" value={data.pdBooks} onChange={set('pdBooks')} textarea rows={5}
          placeholder={"Grit\nAtomic Habits\nHow Successful People Think\nThe Psychology of Selling"}/>
        <Input label="Courses / Training" value={data.pdCourses} onChange={set('pdCourses')} placeholder="Digital Marketing, Sales"/>
        <Input label="Events / Conferences" value={data.pdEvents} onChange={set('pdEvents')} placeholder="Business conferences, Neolife events"/>
        <Input label="Why?" value={data.pdWhy} onChange={set('pdWhy')} textarea rows={2}/>
      </>);

      case 'daily': return (<>
        <Input label="Game plan activities" value={data.gamePlan} onChange={set('gamePlan')} textarea rows={3}
          placeholder="What does a productive day look like for you? Describe your ideal daily routine."/>
        <Input label="Habit lock (daily routine)" value={data.habitLock} onChange={set('habitLock')} textarea rows={4}
          placeholder={"Wake up → affirmations → review goals → read book → take break → learn skill → promote → scout → podcast → build team → check off daily tasks"}/>
        <Input label="Daily IPAs (one per line)" value={data.dailyIPAs} onChange={set('dailyIPAs')} textarea rows={6}
          placeholder={"Read a book\nLearn a skill\nPromote\nListen to podcast\nAffirmations\nScouting\nFiverr\nTeam building"}/>
        <Input label="Why?" value={data.dailyWhy} onChange={set('dailyWhy')} textarea rows={2}/>
      </>);

      case 'commit': return (<>
        <Input label="Monthly review day" value={data.reviewDay} onChange={set('reviewDay')} type="number" placeholder="15"/>
        <Input label="Accountability partner" value={data.accountabilityPartner} onChange={set('accountabilityPartner')}
          placeholder="Name of your accountability partner"/>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => set('monthlyReview')(!data.monthlyReview)} style={{
            width: 44, height: 24, borderRadius: 12, border: "none",
            background: data.monthlyReview ? t.success : t.bgSurface,
            position: "relative", cursor: "pointer", transition: "background 0.3s",
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, left: data.monthlyReview ? 23 : 3,
              transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}/>
          </button>
          <span style={{ fontSize: 14, color: t.text }}>I agree to review my goals monthly</span>
        </div>

        <Card bg={t.successBg} border={t.successBdr}>
          <p style={{ fontSize: 14, color: t.text, margin: 0, lineHeight: 1.6 }}>
            You're about to set your yearly plan in motion. This document becomes the anchor for everything — your monthly goals, weekly plans, and daily tasks will all connect back to what you write here.
          </p>
        </Card>
      </>);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, padding: "0 20px 40px" }}>
      {/* Progress */}
      <div style={{ padding: "28px 0 6px" }}>
        <SectionHeader label={`Step ${step + 1} of ${STEPS.length}`}/>
        <PageTitle>{cur.icon} {cur.title}</PageTitle>
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? t.accent : t.bgSurface,
            transition: "background 0.3s",
          }}/>
        ))}
      </div>

      {/* Form content */}
      <div style={{ marginBottom: 24 }}>
        {renderStep()}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10 }}>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
            ← Back
          </Button>
        )}
        {isLast ? (
          <Button onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving your plan...' : '🚀 Launch my year'}
          </Button>
        ) : (
          <Button onClick={() => setStep(step + 1)} style={{ flex: step > 0 ? 2 : 1 }}>
            Continue →
          </Button>
        )}
      </div>
    </div>
  );
}
