"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PeriodoPreset, PERIODO_LABEL } from "@/lib/periodo";
import { shortDay } from "@/lib/format";

const ORDER: PeriodoPreset[] = ["hoje", "7d", "30d", "mes", "inicio", "custom"];

/**
 * Controle global de período (Feature 1). Segmentado de presets + popover de
 * intervalo personalizado. Ao mudar, faz router.push atualizando a query da URL
 * (o dashboard é force-dynamic e relê os dados escopados). Mostra o intervalo
 * resolvido de forma compacta.
 */
export function DateFilter({
  preset,
  desde,
  ate,
  de,
  ateInput,
}: {
  preset: PeriodoPreset;
  desde: string;
  ate: string;
  de: string;
  ateInput: string;
}) {
  const router = useRouter();
  // Esmaece o controle enquanto o servidor recalcula o período — sem isso o
  // clique não produz nenhum sinal até a página inteira trocar.
  const [pendente, iniciar] = useTransition();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(de || desde);
  const [a, setA] = useState(ateInput || ate);

  function go(next: PeriodoPreset) {
    if (next === "custom") {
      setOpen((o) => !o);
      return;
    }
    setOpen(false);
    const params = new URLSearchParams();
    params.set("periodo", next);
    iniciar(() => router.push(`/?${params.toString()}`));
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("periodo", "custom");
    if (d) params.set("de", d);
    if (a) params.set("ate", a);
    setOpen(false);
    iniciar(() => router.push(`/?${params.toString()}`));
  }

  const rangeLabel =
    desde === ate ? shortDay(desde) : `${shortDay(desde)} — ${shortDay(ate)}`;

  return (
    <div
      aria-busy={pendente}
      className={`flex flex-wrap items-center gap-2.5 transition-opacity ${
        pendente ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-line bg-surface-2/60 p-0.5">
        {ORDER.map((p) => {
          const active = preset === p;
          const isCustom = p === "custom";
          return (
            <div key={p} className={isCustom ? "relative" : undefined}>
              <button
                type="button"
                onClick={() => go(p)}
                aria-pressed={active}
                aria-expanded={isCustom ? open : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {isCustom && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M8 3v3m8-3v3M4 8.5h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {PERIODO_LABEL[p]}
              </button>

              {isCustom && open && (
                <>
                  {/* click-away */}
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                    tabIndex={-1}
                  />
                  <form
                    onSubmit={applyCustom}
                    className="card-surface absolute right-0 top-[calc(100%+8px)] z-40 w-[260px] rounded-2xl border border-line-strong p-3.5 shadow-card"
                  >
                    <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                      Intervalo personalizado
                    </p>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-ink-muted">De</span>
                        <input
                          type="date"
                          value={d}
                          max={a || undefined}
                          onChange={(e) => setD(e.target.value)}
                          className="tnum h-9 w-full rounded-lg border border-line bg-base/70 px-2.5 font-mono text-[12.5px] text-ink outline-none transition focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-ink-muted">Até</span>
                        <input
                          type="date"
                          value={a}
                          min={d || undefined}
                          onChange={(e) => setA(e.target.value)}
                          className="tnum h-9 w-full rounded-lg border border-line bg-base/70 px-2.5 font-mono text-[12.5px] text-ink outline-none transition focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
                    >
                      Aplicar
                    </button>
                  </form>
                </>
              )}
            </div>
          );
        })}
      </div>

      <span className="tnum inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 3v3m8-3v3M4 8.5h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {rangeLabel}
      </span>
    </div>
  );
}
