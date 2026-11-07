export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Próximamente. Esta pantalla se construye en la fase correspondiente.</p>
    </section>
  );
}
