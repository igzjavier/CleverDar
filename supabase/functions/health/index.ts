// Endpoint liviano para evitar la pausa por inactividad del plan gratuito.
Deno.serve(() =>
  new Response(JSON.stringify({ ok: true, at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  }),
);
