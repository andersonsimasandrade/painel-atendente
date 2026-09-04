/**
 * Botão de sair. Vive num componente próprio porque precisa existir nos DOIS
 * cabeçalhos. Embutido só no cabeçalho da home, ele ficaria fora do alcance de
 * quem é consultor (a home é só de admin) — e a sessão dura 7 dias, num
 * aparelho que anda na rua.
 */
export function SairButton() {
  return (
    <form action="/api/logout" method="post">
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
        title="Sair do painel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M13 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Sair
      </button>
    </form>
  );
}
