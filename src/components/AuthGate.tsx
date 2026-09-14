import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { api } from '../db';
import { useStore } from '../store';
import type { AuthState } from '../../shared/api';
export default function AuthGate({ children }: {children: ReactNode}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    setChecking(true);
    try {
      const state = await api<AuthState>('/auth/session');
      setAuthenticated(state.authenticated); if (state.authenticated) setMounted(true); setError(null);
    } catch (reason) { setError((reason as Error).message); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    void check();
    const expired = () => { setAuthenticated(false); setError('Session expired. Sign in to continue with your unsaved input.'); };
    const logout = () => { setAuthenticated(false); setMounted(false); useStore.getState().reset(); };
    window.addEventListener('mycoach-session-expired', expired);
    window.addEventListener('mycoach-logged-out', logout);
    return () => { window.removeEventListener('mycoach-session-expired', expired); window.removeEventListener('mycoach-logged-out', logout); };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try {
      await api('/auth/login', 'POST', {password}); setPassword(''); setAuthenticated(true); setMounted(true);
      void useStore.getState().refresh();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    {mounted && <div className="app-session" hidden={!authenticated}>{children}</div>}
    {!authenticated && <div className="auth-screen"><form className="auth-card" onSubmit={login}>
      <img src="/mycoach-web-icon.png" width="64" height="64" alt="" />
      <h1>MyCoach</h1><p>Your goals, tasks, and habits—together.</p>
      {checking ? <p>Connecting…</p> : <>
        <label htmlFor="owner-password">Owner password</label>
        <input id="owner-password" className="modal-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus disabled={busy} />
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button className="btn btn-ghost" type="button" onClick={() => void check()}>Retry connection</button>
      </>}
    </form></div>}
  </>;
}
