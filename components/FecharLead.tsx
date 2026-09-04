"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL, formatDateTime, parseValorBR } from "@/lib/format";

interface FecharLeadProps {
  telefone: string;
  fechado: boolean;
  valorFechado: number | null;
  dataFechamento: string | null;
}

export function FecharLead({
  telefone,
  fechado,
  valorFechado,
  dataFechamento,
}: FecharLeadProps) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fechar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        setLoading(false);
        return;
      }
      setValor("");
      router.refresh();
      setLoading(false);
    } catch {
      setError("Falha de rede. Tente novamente.");
      setLoading(false);
    }
  }

  function onMarcar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseValorBR(valor);
    if (!Number.isFinite(v) || v <= 0) {
      setError("Informe um valor de fechamento válido.");
      return;
    }
    void post({ telefone, valor: v });
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">
          Retorno do negócio
        </p>
        {fechado && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11.5px] font-medium leading-none text-brand ring-1 ring-inset ring-brand/25">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m5 13 4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Fechado
          </span>
        )}
      </div>

      {fechado ? (
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="tnum font-display text-[26px] font-semibold leading-none tracking-tight text-brand">
              {formatBRL(valorFechado)}
            </div>
            {dataFechamento && (
              <p className="mt-1.5 text-[11.5px] text-ink-faint">
                Fechado em {formatDateTime(dataFechamento)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void post({ telefone, desfazer: true })}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink-muted" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v1"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Desfazer
          </button>
        </div>
      ) : (
        <form onSubmit={onMarcar} className="mt-2.5 flex flex-wrap items-stretch gap-2">
          <div className="relative min-w-[140px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">
              R$
            </span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Valor do negócio fechado (R$)"
              className="tnum h-9 w-full rounded-lg border border-line bg-base/70 pl-8 pr-3 font-mono text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !valor.trim()}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Marcar como fechado
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
