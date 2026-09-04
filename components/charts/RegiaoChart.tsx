"use client";

import { useState } from "react";
import { RegiaoCount } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { EmptyState } from "../EmptyState";

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`;
}

/** Barras horizontais de leads ativos por UF. */
export function RegiaoChart({ data }: { data: RegiaoCount[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...data.map((d) => d.count), 1);

  if (total === 0) {
    return (
      <EmptyState
        title="Sem estado informado"
        hint="Assim que os leads trouxerem cidade/UF, a distribuição regional aparece aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => {
        const w = (d.count / max) * 100;
        const isActive = active === d.uf;
        const nd = d.uf === "N/D";
        const pct = total > 0 ? (d.count / total) * 100 : 0;
        const color = nd ? "#5C6A64" : "#35B06E";
        return (
          <div
            key={d.uf}
            className="grid grid-cols-[44px_1fr_auto] items-center gap-3"
            onMouseEnter={() => setActive(d.uf)}
            onMouseLeave={() => setActive(null)}
          >
            <span
              className={`text-right font-mono text-[12px] ${
                nd ? "text-ink-faint" : "text-ink-muted"
              }`}
            >
              {d.uf}
            </span>

            <div className="relative h-6 rounded-md bg-white/[0.03]">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                style={{
                  width: `${Math.max(w, d.count > 0 ? 4 : 0)}%`,
                  background: `linear-gradient(90deg, ${hexToRgba(color, 0.5)}, ${hexToRgba(
                    color,
                    0.95,
                  )})`,
                  boxShadow: isActive ? `0 0 0 1px ${hexToRgba(color, 0.85)}` : "none",
                }}
              />
              {isActive && (
                <div className="pointer-events-none absolute -top-1 right-0 z-20 -translate-y-full whitespace-nowrap rounded-lg border border-line-strong bg-elevated/95 px-2.5 py-1.5 text-[11px] shadow-card backdrop-blur">
                  <span className="tnum text-ink">
                    <b>{formatNumber(d.count)}</b> leads
                  </span>
                  <span className="ml-1.5 text-ink-faint">{formatPercent(pct)} do total</span>
                </div>
              )}
            </div>

            <span className="tnum w-9 text-right text-[13px] font-semibold text-ink">
              {formatNumber(d.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
