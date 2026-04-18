import { useState } from 'react';
import { useTheme, Card, Button, Badge } from '../lib/theme';
import { generateCalibration } from '../lib/ai';

export default function CalibrationCard({ goals, pastReport, yearlyPlan, onDismiss }) {
  const t = useTheme();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function runCalibration() {
    setLoading(true);
    try {
      const r = await generateCalibration(goals, pastReport, yearlyPlan);
      setResult(r);
    } catch (e) {
      console.error(e);
      alert('Calibration failed — check API key.');
    }
    setLoading(false);
  }

  const assessColors = {
    realistic: { color: t.success, bg: t.successBg, label: "Realistic" },
    ambitious: { color: t.accent, bg: t.accentBg, label: "Ambitious" },
    overloaded: { color: t.danger, bg: t.dangerBg, label: "Overloaded" },
    conservative: { color: t.info, bg: t.infoBg, label: "Conservative" },
  };

  const goalAssessColors = {
    on_track: { color: t.success, bg: t.successBg },
    ambitious: { color: t.accent, bg: t.accentBg },
    unrealistic: { color: t.danger, bg: t.dangerBg },
    easy: { color: t.info, bg: t.infoBg },
  };

  if (!result) {
    return (
      <Card bg={t.bgAccentSofter} border={t.accentBorder} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 4px" }}>AI Reality Check</p>
            <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 12px", lineHeight: 1.5 }}>
              {pastReport
                ? `Last month you set ${pastReport.goalsSet} goals and completed ${pastReport.goalsCompleted} (${pastReport.completionRate}%). Want AI to analyze if your new goals are realistic?`
                : `You have ${goals.length} goals set. Want AI to check if this is realistic?`
              }
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={runCalibration} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Analyzing...' : 'Run calibration'}
              </Button>
              <Button variant="secondary" onClick={() => { setDismissed(true); onDismiss?.(); }} style={{ flex: 1 }}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const assess = assessColors[result.overallAssessment] || assessColors.ambitious;

  return (
    <Card border={assess.color + '30'} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>AI Calibration</p>
        </div>
        <Badge label={assess.label} color={assess.color} bg={assess.bg}/>
      </div>

      <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: "0 0 14px" }}>
        {result.feedback}
      </p>

      {result.recommendedGoalCount && (
        <div style={{
          background: t.bgSurface, borderRadius: 10, padding: "10px 14px",
          marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: t.textSec }}>Recommended goals</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display', serif" }}>
            {result.recommendedGoalCount}
          </span>
        </div>
      )}

      {/* Per-goal feedback */}
      {result.goalFeedback?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {result.goalFeedback.map((gf, i) => {
            const gc = goalAssessColors[gf.assessment] || goalAssessColors.ambitious;
            return (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10, background: t.bgSurface,
                border: `1px solid ${t.borderLt}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{gf.goalTitle}</span>
                  <Badge label={gf.assessment} color={gc.color} bg={gc.bg}/>
                </div>
                <p style={{ fontSize: 12, color: t.textSec, margin: 0, lineHeight: 1.5 }}>{gf.suggestion}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      {result.tips?.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.borderLt}`, paddingTop: 10 }}>
          {result.tips.map((tip, i) => (
            <p key={i} style={{ fontSize: 12, color: t.textSec, margin: i === 0 ? 0 : "6px 0 0", lineHeight: 1.5 }}>
              💡 {tip}
            </p>
          ))}
        </div>
      )}

      <button onClick={() => { setDismissed(true); onDismiss?.(); }} style={{
        width: "100%", padding: "8px", marginTop: 12, borderRadius: 8,
        border: `1px solid ${t.border}`, background: t.bgCard,
        color: t.textTer, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
      }}>Dismiss</button>
    </Card>
  );
}
