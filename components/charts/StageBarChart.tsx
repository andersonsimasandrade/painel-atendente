"use client";

import { useState } from "react";
import { StageCount } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { EmptyState } from "../EmptyState";

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`;
}

export function StageBarChart({ stages }: { stages: StageCount[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = stages.reduce((s, x) => s + x.count, 0);
  const max = Math.max(...stages.map((s) => s.count), 1);

  if (total === 0) {
    return (
      <EmptyState
        title="Sem leads distribuídos"
        hint="Os estágios atuais aparecem aqui conforme os leads avançam."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {stages.map((s) => {
        const w = (s.count / max) * 100;
        const isActive = active === s.stage;
        const pct = total > 0 ? (s.count / total) * 100 : 0;
        return (
          <div
            key={s.stage}
            className="grid grid-cols-[92px_1fr_auto] items-center gap-3"
            onMouseEnter={() => setActive(s.stage)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="flex items-center justify-end gap-1.5 text-right">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="truncate text-[12px] text-ink-muted">{s.label}</span>
            </div>

            <div className="relative h-6 rounded-md bg-white/[0.03]">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                style={{
                  width: `${Math.max(w, s.count > 0 ? 4 : 0)}%`,
                  background: `linear-gradient(90deg, ${hexToRgba(s.color, 0.55)}, ${hexToRgba(
                    s.color,
                    0.95,
                  )})`,
                  boxShadow: isActive ? `0 0 0 1px ${hexToRgba(s.color, 0.85)}` : "none",
                }}
              />
              {isActive && s.count > 0 && (
                <div className="pointer-events-none absolute -top-1 right-0 z-20 -translate-y-full whitespace-nowrap rounded-lg border border-line-strong bg-elevated/95 px-2.5 py-1.5 text-[11px] shadow-card backdrop-blur">
                  <span className="tnum text-ink">
                    <b>{formatNumber(s.count)}</b> leads
                  </span>
                  <span className="ml-1.5 text-ink-faint">{formatPercent(pct)} do total</span>
                </div>
              )}
            </div>

            <div className="tnum w-9 text-right text-[13px] font-semibold text-ink">
              {formatNumber(s.count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
