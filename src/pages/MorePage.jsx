import { useEffect, useState } from 'react';
import { auth, db, doc, getDoc, updateDoc } from '../lib/firebase';
import { useTheme, Card, SectionHeader, PageTitle } from '../lib/theme';
import { signOut } from 'firebase/auth';
import { setMemberLeaderboardOptOut } from '../lib/team';

const MENU = [
  { k: 'habit', icon: '🔥', title: '66-Day Habit', desc: 'Build one habit that sticks', color: 'accent' },
  { k: 'team', icon: '👥', title: 'Team', desc: 'Members, assigned tasks, fines', color: 'purple' },
  { k: 'analytics', icon: '📊', title: 'Analytics & History', desc: 'Trends, reports, AI insights', color: 'info' },
  { k: 'yearly', icon: '🌟', title: 'Yearly Plan', desc: 'Your vision and roadmap', color: 'success' },
  { k: 'profile', icon: '🪪', title: 'Profile', desc: 'What your AI coach knows about you', color: 'accent' },
];

export default function MorePage({ setView, isDark, toggleTheme }) {
  const t = useTheme();
  const user = auth.currentUser;
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const [optedOut, setOptedOut] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const u = snap.data();
          setOptedOut(!!u.leaderboardOptOut);
          setHasTeam(!!u.teamId);
        }
      } catch (e) { console.error(e); }
    })();
  }, [user?.uid]);

  async function toggleOptOut() {
    const next = !optedOut;
    setOptedOut(next);
    try { await setMemberLeaderboardOptOut(user.uid, next); }
    catch (e) { console.error(e); setOptedOut(!next); }
  }

  const colorMap = {
    accent: { bg: t.accentBg, border: t.accentBorder, text: t.accent },
    purple: { bg: t.purpleBg, border: t.purpleBdr, text: t.purple },
    info: { bg: t.infoBg, border: "rgba(40,116,166,0.15)", text: t.info },
    success: { bg: t.successBg, border: t.successBdr, text: t.success },
  };

  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{ padding: "28px 0 22px" }}>
        <SectionHeader label="Menu" color={t.accent}/>
        <PageTitle>More options</PageTitle>
        <p style={{ fontSize: 13, color: t.textTer, margin: "6px 0 0" }}>Hey {firstName}</p>
      </div>

      {/* Menu items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {MENU.map(item => {
          const c = colorMap[item.color];
          return (
            <Card key={item.k} onClick={() => setView(item.k)}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: c.bg, border: `1px solid ${c.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: t.textSec, margin: "2px 0 0" }}>{item.desc}</p>
                </div>
                <span style={{ color: t.textTer, fontSize: 20 }}>›</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Settings */}
      <Card style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>⚙️ Settings</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: t.text, margin: 0 }}>Theme</p>
            <p style={{ fontSize: 12, color: t.textTer, margin: "2px 0 0" }}>{isDark ? 'Dark mode' : 'Light mode'}</p>
          </div>
          <button onClick={toggleTheme} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            <div style={{
              width: 48, height: 26, borderRadius: 13,
              background: isDark ? t.accent : t.bgSurface,
              border: `1px solid ${t.border}`, position: "relative", transition: "all 0.3s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: isDark ? "#fff" : t.accent,
                position: "absolute", top: 2, left: isDark ? 25 : 2,
                transition: "left 0.3s",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
              }}>{isDark ? "🌙" : "☀️"}</div>
            </div>
          </button>
        </div>
      </Card>

      {/* Privacy */}
      {hasTeam && (
        <Card style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>🔒 Privacy</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: t.text, margin: 0 }}>Hide me from leaderboard</p>
              <p style={{ fontSize: 12, color: t.textTer, margin: "2px 0 0" }}>{optedOut ? "You're hidden from rankings" : "You appear in team rankings"}</p>
            </div>
            <button onClick={toggleOptOut} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              <div style={{
                width: 48, height: 26, borderRadius: 13,
                background: optedOut ? t.purple : t.bgSurface,
                border: `1px solid ${t.border}`, position: "relative", transition: "all 0.3s",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: optedOut ? 25 : 2,
                  transition: "left 0.3s",
                }}/>
              </div>
            </button>
          </div>
        </Card>
      )}

      {/* Profile summary (tap to open full profile) */}
      <Card onClick={() => setView('profile')} style={{ marginBottom: 12, cursor: 'pointer' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: t.textTer, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Profile</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>{user?.displayName || '—'}</p>
            <p style={{ fontSize: 12, color: t.textSec, margin: "2px 0 0" }}>{user?.email || '—'}</p>
          </div>
          <span style={{ color: t.textTer, fontSize: 20 }}>›</span>
        </div>
      </Card>

      {/* Sign out */}
      <button onClick={() => signOut(auth)} style={{
        width: "100%", padding: "12px", borderRadius: 12,
        border: `1px solid ${t.border}`, background: t.bgCard,
        color: t.danger, fontSize: 13, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>Sign out</button>
    </div>
  );
}
