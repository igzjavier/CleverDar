import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../lib/supabase';

// Sin configuración de Supabase (antes de Fase 0 completa) no se bloquea la UI:
// se muestra un aviso en LoginPage.
export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setState('out');
      return;
    }
    supabase.auth.getSession().then(({ data }) => setState(data.session ? 'in' : 'out'));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setState(session ? 'in' : 'out'),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === 'loading') {
    return <div className="flex h-full items-center justify-center text-muted">Cargando…</div>;
  }
  if (state === 'out') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
