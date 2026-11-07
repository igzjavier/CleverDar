import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError('Correo o contraseña incorrectos.');
    else navigate('/hoy', { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">CleverDar</h1>
      <p className="mb-8 text-muted">Tu agenda y tu plan de estudio, en un solo lugar.</p>

      {!supabaseConfigured ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Falta configurar Supabase. Crea el archivo <code>.env</code> con
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
