import { createContext, useContext } from 'react';

export const ThemeCtx = createContext();
export const useTheme = () => useContext(ThemeCtx);

export const themes = {
  light: {
    bg: "#F8F7F4", bgCard: "#FFFFFF", bgSurface: "#F1F0EC",
    bgAccentSoft: "rgba(207,88,34,0.05)", bgAccentSofter: "rgba(207,88,34,0.03)",
    text: "#1A1A1A", textSec: "#5C5C5C", textTer: "#8A8A8A", textInv: "#FFFFFF",
    accent: "#CF5822", accentSoft: "#E8734A", accentBg: "rgba(207,88,34,0.08)", accentBorder: "rgba(207,88,34,0.18)",
    success: "#1A8558", successBg: "rgba(26,133,88,0.08)", successBdr: "rgba(26,133,88,0.15)",
    danger: "#C0392B", dangerBg: "rgba(192,57,43,0.08)",
    info: "#2874A6", infoBg: "rgba(40,116,166,0.08)",
    purple: "#6C3FA0", purpleBg: "rgba(108,63,160,0.06)", purpleBdr: "rgba(108,63,160,0.15)",
    border: "rgba(0,0,0,0.07)", borderLt: "rgba(0,0,0,0.04)",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
    navBg: "rgba(248,247,244,0.92)",
    inputBg: "#FFFFFF", inputBorder: "rgba(0,0,0,0.12)",
  },
  dark: {
    bg: "#0F1117", bgCard: "#1A1D26", bgSurface: "#14171F",
    bgAccentSoft: "rgba(232,115,74,0.1)", bgAccentSofter: "rgba(232,115,74,0.04)",
    text: "#EAEAEA", textSec: "#A0A0A0", textTer: "#606060", textInv: "#0F1117",
    accent: "#E8734A", accentSoft: "#F0926E", accentBg: "rgba(232,115,74,0.12)", accentBorder: "rgba(232,115,74,0.25)",
    success: "#34D399", successBg: "rgba(52,211,153,0.1)", successBdr: "rgba(52,211,153,0.2)",
    danger: "#EF4444", dangerBg: "rgba(239,68,68,0.1)",
    info: "#60A5FA", infoBg: "rgba(96,165,250,0.1)",
    purple: "#A78BFA", purpleBg: "rgba(167,139,250,0.1)", purpleBdr: "rgba(167,139,250,0.2)",
    border: "rgba(255,255,255,0.08)", borderLt: "rgba(255,255,255,0.04)",
    shadow: "0 1px 3px rgba(0,0,0,0.2)",
    navBg: "rgba(15,17,23,0.92)",
    inputBg: "#1A1D26", inputBorder: "rgba(255,255,255,0.12)",
  },
};

// ── Shared UI Components ──

export function ProgressRing({ value, size = 54, stroke = 5, color }) {
  const t = useTheme();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.borderLt} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color||t.accent} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c-(value/100)*c} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}/>
    </svg>
  );
}

export function ProgressBar({ value, color, height = 6 }) {
  const t = useTheme();
  return (
    <div style={{ width: "100%", height, borderRadius: height, background: t.bgSurface, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(value,100)}%`, height: "100%", borderRadius: height,
        background: color||t.accent, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}/>
    </div>
  );
}

export function Card({ children, bg, border: bdr, style = {}, onClick }) {
  const t = useTheme();
  return (
    <div onClick={onClick} style={{
      background: bg||t.bgCard, border: `1px solid ${bdr||t.border}`,
      borderRadius: 16, padding: "18px 20px", boxShadow: t.shadow,
      transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}

export function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: bg, color }}>
      {label}
    </span>
  );
}

export function Input({ label, value, onChange, type = "text", placeholder, textarea, rows = 3 }) {
  const t = useTheme();
  const shared = {
    width: "100%", padding: textarea ? "12px 14px" : "11px 14px",
    borderRadius: 12, border: `1px solid ${t.inputBorder}`,
    background: t.inputBg, color: t.text, fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
    resize: textarea ? "vertical" : undefined,
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6 }}>{label}</label>}
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
          style={shared} onFocus={e => e.target.style.borderColor = t.accent}
          onBlur={e => e.target.style.borderColor = t.inputBorder}/>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={shared} onFocus={e => e.target.style.borderColor = t.accent}
          onBlur={e => e.target.style.borderColor = t.inputBorder}/>
      )}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", style = {}, disabled }) {
  const t = useTheme();
  const styles = {
    primary: { background: t.accent, color: "#fff", border: "none", fontWeight: 700 },
    secondary: { background: t.bgSurface, color: t.text, border: `1px solid ${t.border}`, fontWeight: 600 },
    ghost: { background: "transparent", color: t.accent, border: `1px solid ${t.accentBorder}`, fontWeight: 600 },
    danger: { background: t.danger, color: "#fff", border: "none", fontWeight: 700 },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "13px 20px", borderRadius: 12,
      fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      opacity: disabled ? 0.5 : 1,
      ...styles[variant], ...style,
    }}>{children}</button>
  );
}

export function SectionHeader({ label, color }) {
  const t = useTheme();
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: color || t.accent,
      letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px",
    }}>{label}</p>
  );
}

export function PageTitle({ children }) {
  const t = useTheme();
  return (
    <h1 style={{
      fontFamily: "'Playfair Display', serif", fontSize: 26,
      fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.2,
    }}>{children}</h1>
  );
}

// Utilities
export function pct(c, t) { return Math.min(Math.round((c / t) * 100), 100); }
export function paceText(c, t, d) { const r = t - c; return r <= 0 ? "Completed!" : `${(r / Math.max(d, 1)).toFixed(1)}/day to finish`; }
export function goalColor(val, t) { return val >= 100 ? t.success : val >= 50 ? t.accent : t.danger; }

export const TYPE_META = {
  target: { label: "Target", colorKey: "accent", bgKey: "accentBg" },
  measurable: { label: "Measurable", colorKey: "info", bgKey: "infoBg" },
  habit: { label: "Habit", colorKey: "success", bgKey: "successBg" },
  checklist: { label: "Checklist", colorKey: "purple", bgKey: "purpleBg" },
};
