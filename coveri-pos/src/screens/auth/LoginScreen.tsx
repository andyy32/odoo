import { useState } from 'react';
import './auth.css';
import { Button } from '@/components/primitives';
import { useAuthStore } from '@/stores/authStore';

/** Owner/manager signs in once on the shared terminal (Supabase Auth). */
export function LoginScreen() {
  const { signIn, signInError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await signIn(email, password);
    setBusy(false);
  };

  return (
    <div className="auth">
      <div className="auth__brand">
        <div className="auth__mark">
          COV<em>E</em>RI
        </div>
        <div className="auth__tag">Service, Simplified.</div>
      </div>

      <form className="auth__card" onSubmit={submit}>
        <div className="auth__title">Sign in</div>
        <div className="auth__field">
          <label className="auth__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="auth__input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="auth__field">
          <label className="auth__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="auth__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="auth__error">{signInError}</div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
