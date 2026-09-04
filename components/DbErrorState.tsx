"use client";

import Link from "next/link";
import { Logo } from "./Logo";

/**
 * Tela cheia de "o banco não respondeu".
 *
 * Era um beco sem saída: substituía a página inteira, imprimia a string crua do
 * erro e não oferecia nem recarregar nem ir pra outra seção — o consultor tinha
 * de saber recarregar sozinho. Agora tem ação (o erro mais comum aqui é timeout
 * ou hiccup de rede, e recarregar resolve), caminho de fuga, e o detalhe técnico
 * fica recolhido: quem está no meio de um atendimento não precisa ler
 * "canceling statement due to statement timeout".
 */
export function DbErrorState({ error }: { error: string }) {
  const faltaEnv = /Variável de ambiente obrigatória ausente/.test(error);
  return (
    <main className="relative z-[1] mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 opacity-90">
        <Logo size={52} />
      </div>
      <div className="card-surface w-full rounded-2xl border border-line p-6 shadow-card sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber/10 text-amber">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v5m0 3.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">Não consegui carregar os dados</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          {faltaEnv
            ? error
            : "O banco não respondeu a tempo. Quase sempre é passageiro — tente de novo."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Tentar de novo
          </button>
          <Link
            href="/prioridades"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-[13px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Ir para Prioridades
          </Link>
        </div>

        <details className="mt-5 text-left">
          <summary className="cursor-pointer list-none text-[11.5px] text-ink-muted underline-offset-2 hover:underline">
            Ver detalhe técnico
          </summary>
          <div className="mt-2 rounded-lg border border-line bg-base/60 px-4 py-3">
            <code className="block break-words font-mono text-xs text-ink-muted">{error}</code>
          </div>
        </details>
      </div>
    </main>
  );
}
