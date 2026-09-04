import { Logo } from "./Logo";

/**
 * Esqueleto de carregamento das rotas pesadas.
 *
 * Todas as páginas são `force-dynamic` com Promise.all ao Supabase, e o painel
 * não tinha um único loading.tsx: no 4G o consultor tocava em "Leads" ou trocava
 * um filtro e a tela ficava EXATAMENTE igual durante toda a consulta — então ele
 * tocava de novo, enfileirando consultas na página mais pesada.
 *
 * Mostra o cabeçalho no lugar (a página só aparece depois, com o SubNav de
 * verdade) e blocos pulsando no formato do conteúdo que vem.
 */
export function PageSkeleton({
  titulo,
  kpis = 0,
  blocos = 2,
}: {
  /** Nome da seção. Sem ele, só "Carregando…" — serve pro fallback da raiz. */
  titulo?: string;
  kpis?: number;
  blocos?: number;
}) {
  return (
    <div className="relative z-[1] min-h-[100dvh]">
      <div className="sticky top-0 z-30 border-b border-line bg-base/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3.5 px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo size={40} />
          <div className="leading-tight">
            {titulo && (
              <p className="font-display text-[17px] font-semibold tracking-tight text-ink">
                {titulo}
              </p>
            )}
            <p className="text-[12px] text-ink-muted">Carregando…</p>
          </div>
        </div>
      </div>

      <main
        className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Carregando {titulo ?? "o painel"}…</span>

        {kpis > 0 && (
          <div className="mb-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: kpis }).map((_, i) => (
              <div
                key={i}
                className="card-surface h-[104px] animate-pulse rounded-2xl border border-line"
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {Array.from({ length: blocos }).map((_, i) => (
            <div
              key={i}
              className="card-surface h-64 animate-pulse rounded-2xl border border-line"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
