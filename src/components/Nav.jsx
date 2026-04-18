import { useTheme } from '../lib/theme';

const ITEMS = [
  { k: "dash", l: "Home", d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { k: "goals", l: "Goals", d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { k: "weekly", l: "Weekly", d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { k: "tracker", l: "Tracker", d: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { k: "more", l: "More", d: "M4 6h16M4 12h16M4 18h16" },
];

const MORE_ACTIVE = ['habit', 'team', 'analytics', 'yearly', 'more'];

export default function Nav({ active, setActive }) {
  const t = useTheme();
  return (
    <nav style={{
      position: "sticky", bottom: 0, zIndex: 50,
      background: t.navBg, backdropFilter: "blur(20px)",
      borderTop: `1px solid ${t.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      padding: "4px 4px max(4px, env(safe-area-inset-bottom))",
    }}>
      {ITEMS.map(i => {
        const isActive = i.k === 'more' ? MORE_ACTIVE.includes(active) : active === i.k;
        return (
          <button key={i.k} onClick={() => setActive(i.k)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            padding: "8px 6px", borderRadius: 10, flex: 1,
          }}>
            <svg width="22" height="22" fill="none" stroke={isActive?t.accent:t.textTer}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d={i.d}/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: isActive?700:500, color: isActive?t.accent:t.textTer }}>{i.l}</span>
          </button>
        );
      })}
    </nav>
  );
}
