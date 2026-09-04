"use client";

import { useState } from "react";
import { FunnelStep } from "@/lib/types";
import { FUNNEL_RAMP } from "@/lib/theme";
import { formatNumber, formatPercent } from "@/lib/format";
import { EmptyState } from "../EmptyState";

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`;
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = steps[0]?.count ?? 0;

  if (top === 0) {
    return (
      <EmptyState
        title="Nenhum lead no funil ainda"
        hint="Assim que o robô captar leads pelo anúncio, o funil aparece aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((step, i) => {
        const color = FUNNEL_RAMP[i] ?? FUNNEL_RAMP[FUNNEL_RAMP.length - 1];
        const widthPct = Math.max(step.pctOfTop, 6); // largura mínima p/ legibilidade
        const isActive = active === i;
        const prev = i > 0 ? steps[i - 1].count : step.count;
        const drop = Math.max(0, prev - step.count);
        return (
          <div
            key={step.key}
            className="group flex items-center gap-3"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="w-[86px] shrink-0 text-right">
              <div className="text-[12.5px] font-medium text-ink">{step.label}</div>
              <div className="tnum text-[10.5px] text-ink-faint">
                {formatPercent(step.pctOfTop)}
              </div>
            </div>

            <div className="relative h-12 flex-1">
              <div
                className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-[10px] transition-all duration-300"
                style={{
                  width: `${widthPct}%`,
                  minWidth: 64,
                  background: `linear-gradient(180deg, ${hexToRgba(color, 0.95)}, ${hexToRgba(
                    color,
                    0.72,
                  )})`,
                  boxShadow: isActive
                    ? `0 0 0 1px ${hexToRgba(color, 0.9)}, 0 8px 26px -10px ${hexToRgba(color, 0.7)}`
                    : `inset 0 1px 0 ${hexToRgba("#ffffff", 0.16)}`,
                  transform: `translateX(-50%) scale(${isActive ? 1.015 : 1})`,
                }}
              >
                <span className="tnum font-display text-[15px] font-semibold text-[#04140d]">
                  {formatNumber(step.count)}
                </span>
              </div>

              {/* Tooltip */}
              {isActive && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line-strong bg-elevated/95 px-3 py-2 text-left shadow-card backdrop-blur">
                  <div className="mb-1 text-[12px] font-semibold text-ink">{step.label}</div>
                  <div className="tnum flex flex-col gap-0.5 text-[11px] text-ink-muted">
                    <span>
                      <b className="text-ink">{formatNumber(step.count)}</b> leads alcançaram
                    </span>
                    <span>
                      {formatPercent(step.retention)} do passo anterior
                    </span>
                    {i > 0 && drop > 0 && (
                      <span className="text-amber">−{formatNumber(drop)} saíram aqui</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-[52px] shrink-0 text-left">
              <div className="tnum text-[13px] font-semibold text-ink">
                {formatNumber(step.count)}
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-1 flex items-center justify-between border-t border-line pt-3 text-[12px]">
        <span className="text-ink-muted">Conversão topo → agendado</span>
        <span className="tnum font-display text-[15px] font-semibold text-brand">
          {formatPercent(steps[steps.length - 1]?.pctOfTop ?? 0)}
        </span>
      </div>
    </div>
  );
}
