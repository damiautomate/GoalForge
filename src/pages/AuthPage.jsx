import { useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, doc, setDoc, serverTimestamp } from '../lib/firebase';
import { useTheme, Input, Button } from '../lib/theme';

export default function AuthPage() {
  const t = useTheme();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, phone: phone || null, teamCode: teamCode || null,
          createdAt: serverTimestamp(), hasYearlyPlan: false,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      };
      setError(msgs[err.code] || err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      justifyContent: "center", padding: "40px 24px",
      background: t.bg,
    }}>
      {/* Logo area */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: t.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 24, color: "#fff", fontWeight: 800,
          fontFamily: "'Playfair Display', serif",
        }}>G</div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 30,
          fontWeight: 800, color: t.text, margin: "0 0 4px",
        }}>GoalForge</h1>
        <p style={{ fontSize: 14, color: t.textSec, margin: 0 }}>
          {mode === 'login' ? 'Welcome back — keep pushing.' : 'Start building your future.'}
        </p>
      </div>

      {/* Form card */}
      <div style={{
        background: t.bgCard, border: `1px solid ${t.border}`,
        borderRadius: 20, padding: "28px 24px", boxShadow: t.shadow,
        maxWidth: 400, width: "100%", margin: "0 auto",
      }}>
        {mode === 'signup' && (
          <Input label="Full name" value={name} onChange={setName} placeholder="Damilare Babalola"/>
        )}
        <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com"/>
        <Input label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters"/>
        {mode === 'signup' && (
          <Input label="WhatsApp number" value={phone} onChange={setPhone} type="tel" placeholder="+234XXXXXXXXXX (for AI coach)"/>
        )}
        {mode === 'signup' && (
          <Input label="Team code (optional)" value={teamCode} onChange={setTeamCode} placeholder="e.g. ELV2026"/>
        )}

        {error && (
          <div style={{
            background: t.dangerBg, border: `1px solid rgba(192,57,43,0.15)`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: t.danger,
          }}>{error}</div>
        )}

        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>

        <p style={{ textAlign: "center", fontSize: 13, color: t.textSec, marginTop: 18, marginBottom: 0 }}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{ color: t.accent, fontWeight: 600, cursor: "pointer" }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}
