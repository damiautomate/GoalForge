import { useState, useEffect } from 'react';
import { useAuth } from './lib/useAuth';
import { ThemeCtx, themes } from './lib/theme';
import AuthPage from './pages/AuthPage';
import ProfileEnrichmentSetup from './pages/ProfileEnrichmentSetup';
import YearlyPlanSetup from './pages/YearlyPlanSetup';
import Dashboard from './pages/Dashboard';
import GoalsPage from './pages/GoalsPage';
import WeeklyPage from './pages/WeeklyPage';
import TrackerPage from './pages/TrackerPage';
import TeamPage from './pages/TeamPage';
import HabitPage from './pages/HabitPage';
import YearlyPage from './pages/YearlyPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import MorePage from './pages/MorePage';
import Nav from './components/Nav';

export default function App() {
  const { user, profile, loading, setProfile } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [view, setView] = useState('dash');
  const t = isDark ? themes.dark : themes.light;

  // Show loading
  if (loading) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: t.bg, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: t.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", fontSize: 20, color: "#fff", fontWeight: 800,
          fontFamily: "'Playfair Display', serif",
        }}>G</div>
        <p style={{ color: t.textSec, fontSize: 14 }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <ThemeCtx.Provider value={t}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet"/>
      <div style={{
        background: t.bg, color: t.text, minHeight: "100vh",
        maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif", transition: "background 0.3s, color 0.3s",
      }}>
        {!user ? (
          <AuthPage/>
        ) : !profile?.hasEnrichedProfile ? (
          <ProfileEnrichmentSetup
            onComplete={() => setProfile(prev => ({ ...prev, hasEnrichedProfile: true }))}
            onSkip={() => setProfile(prev => ({ ...prev, hasEnrichedProfile: 'skipped' }))}
          />
        ) : !profile?.hasYearlyPlan ? (
          <YearlyPlanSetup onComplete={() => setProfile(prev => ({ ...prev, hasYearlyPlan: true }))}/>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 70 }}>
              {view === 'dash' && <Dashboard/>}
              {view === 'goals' && <GoalsPage/>}
              {view === 'weekly' && <WeeklyPage/>}
              {view === 'tracker' && <TrackerPage/>}
              {view === 'team' && <TeamPage/>}
              {view === 'habit' && <HabitPage/>}
              {view === 'analytics' && <AnalyticsPage/>}
              {view === 'yearly' && <YearlyPage setView={setView}/>}
              {view === 'profile' && <ProfilePage/>}
              {view === 'more' && <MorePage setView={setView} isDark={isDark} toggleTheme={() => setIsDark(!isDark)}/>}
            </div>
            <Nav active={view} setActive={setView}/>
          </>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
