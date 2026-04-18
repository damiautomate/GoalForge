import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc } from './firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch (e) {
          console.error('Profile fetch error:', e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, profile, loading, setProfile };
}
