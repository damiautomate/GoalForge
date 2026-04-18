import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc } from '../lib/firebase';
import { useTheme, Card, ProgressBar, SectionHeader, PageTitle, pct } from '../lib/theme';
import { signOut } from 'firebase/auth';

export default function YearlyPage() {
  const t = useTheme();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser.uid;
      const year = String(new Date().getFullYear());
      try {
        const snap = await getDoc(doc(db, 'yearlyPlans', uid, year, 'plan'));
        if (snap.exists()) setPlan(snap.data());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: t.textTer }}>Loading...</div>;
  if (!plan) return <div style={{ padding: "40px 20px", textAlign: "center", color: t.textTer }}>No yearly plan found.</div>;

  const user = auth.currentUser;
  const nm = plan.networkMarketing || {};
  const fr = plan.freelancing || {};
  const pd = plan.personalDev || {};
  const inc = plan.income || {};
  const daily = plan.dailyStructure || {};
  const commit = plan.commitment || {};
  const books = pd.books || [];

  function Section({ title, icon, children }) {
    return (
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>
          {icon} {title}
        </p>
        {children}
      </Card>
    );
  }

  function Row({ label, value }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.borderLt}` }}>
        <span style={{ fontSize: 13, color: t.textSec }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value || '—'}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label={`${plan.year || new Date().getFullYear()} Goal Plan`} color={t.purple}/>
        <PageTitle>Year at a Glance</PageTitle>
        <p style={{ fontSize: 13, color: t.textTer, margin: "6px 0 0" }}>
          {user?.displayName}
          {plan.wordOfYear && <> · Word: <span style={{ color: t.purple, fontWeight: 600 }}>{plan.wordOfYear}</span></>}
        </p>
      </div>

      {/* Vision */}
      <Card bg={t.purpleBg} border={t.purpleBdr} style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.purple, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px" }}>Annual Vision</p>
        <p style={{ fontSize: 14, color: t.text, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>"{plan.vision}"</p>
        {plan.motivation && (
          <p style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, margin: "10px 0 0" }}>
            <span style={{ fontWeight: 600 }}>Motivation:</span> {plan.motivation}
          </p>
        )}
      </Card>

      {/* Income */}
      <Section title="Income Goals" icon="💰">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 24, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif", margin: 0 }}>
              ${(inc.total || 0).toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, color: t.textSec, margin: 0 }}>${(inc.monthlyTarget || 0).toLocaleString()}/mo</p>
            <p style={{ fontSize: 12, color: t.textTer, margin: "2px 0 0" }}>${(inc.weeklyTarget || 0).toLocaleString()}/wk</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          {[
            { l: "Minimum", v: inc.minimum },
            { l: "Realistic", v: inc.realistic },
            { l: "Dream", v: inc.dream },
          ].map((x, i) => (
            <div key={i} style={{ textAlign: "center", padding: "8px", borderRadius: 8, background: t.bgSurface }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>${(x.v || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: t.textTer }}>{x.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Network Marketing */}
      <Section title="Network Marketing" icon="👥">
        <Row label="Team size" value={`${nm.currentTeamSize || 0} → ${nm.targetTeamSize || 0}`}/>
        <Row label="Rank" value={`${nm.currentRank || '—'} → ${nm.targetRank || '—'}`}/>
        <Row label="Recruitment pace" value={nm.recruitmentPace}/>
        <Row label="Income goal" value={nm.incomeGoal}/>
        {nm.quarterlyRanks && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            {['q1','q2','q3','q4'].map((q, i) => (
              <div key={q} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 8, background: t.bgSurface }}>
                <div style={{ fontSize: 9, color: t.textTer, fontWeight: 600, textTransform: "uppercase" }}>Q{i+1}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginTop: 2 }}>{nm.quarterlyRanks[q] || '—'}</div>
              </div>
            ))}
          </div>
        )}
        {nm.why && <p style={{ fontSize: 12, color: t.textSec, margin: "10px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>Why: {nm.why}</p>}
      </Section>

      {/* Freelancing */}
      <Section title="Freelancing" icon="💼">
        <Row label="Platforms" value={fr.platforms}/>
        <Row label="Skills" value={fr.skills}/>
        <Row label="Income goal" value={fr.incomeGoal ? `$${fr.incomeGoal}` : '—'}/>
        <Row label="Projects/month" value={fr.projectsPace}/>
        <Row label="Avg per project" value={fr.avgPerProject ? `$${fr.avgPerProject}` : '—'}/>
        <Row label="Review target" value={fr.reviewTarget}/>
        {fr.why && <p style={{ fontSize: 12, color: t.textSec, margin: "10px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>Why: {fr.why}</p>}
      </Section>

      {/* Personal Dev */}
      <Section title="Personal Development" icon="📚">
        {pd.goal && <p style={{ fontSize: 13, color: t.text, margin: "0 0 12px", lineHeight: 1.5 }}>{pd.goal}</p>}
        {books.length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "0 0 8px" }}>Reading List</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {books.map((b, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  borderRadius: 8, background: t.bgSurface, border: `1px solid ${t.borderLt}`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, background: t.bgCard,
                    border: `1.5px solid ${t.border}`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 10, color: t.textTer, fontWeight: 600,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: t.text }}>{b}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {pd.courses && <Row label="Courses" value={pd.courses}/>}
        {pd.events && <Row label="Events" value={pd.events}/>}
      </Section>

      {/* Daily Structure */}
      <Section title="Daily Structure" icon="⚡">
        {daily.habitLock && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "0 0 6px" }}>Habit Lock (Daily Routine)</p>
            <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: 0 }}>{daily.habitLock}</p>
          </div>
        )}
        {(daily.dailyIPAs || []).length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSec, margin: "0 0 8px" }}>Daily IPAs</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {daily.dailyIPAs.map((ipa, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 20,
                  background: t.accentBg, color: t.accent, fontWeight: 500,
                }}>{ipa}</span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Commitment */}
      <Card bg={t.successBg} border={t.successBdr} style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.success, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px" }}>🤝 Commitment</p>
        <Row label="Monthly review day" value={`${commit.reviewDay || 15}th`}/>
        <Row label="Accountability partner" value={commit.accountabilityPartner}/>
        <Row label="Monthly review" value={commit.monthlyReview ? "✓ Agreed" : "Not set"}/>
      </Card>
    </div>
  );
}
