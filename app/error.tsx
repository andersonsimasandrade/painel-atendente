"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Error boundary do painel.
 *
 * Sem ele, qualquer exceção que não fosse falha de consulta — uma data inválida
 * num gráfico, um campo inesperado, um erro em componente cliente — caía na tela
 * branca do Next ("Application error: a client-side exception has occurred"),
 * sem cabeçalho, sem navegação e sem caminho de volta a não ser digitar a URL.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vai pro log da Vercel: sem isso ninguém do time fica sabendo que quebrou.
    console.error("[painel] erro não tratado:", error);
  }, [error]);

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
        <h1 className="font-display text-xl font-semibold text-ink">Algo quebrou nesta tela</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          O resto do painel continua funcionando. Tente carregar de novo — se
          insistir, me avise pelo suporte com o código abaixo.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
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

        {error.digest && (
          <p className="mt-5 font-mono text-[11px] text-ink-muted">código: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
