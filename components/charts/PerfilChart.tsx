"use client";

import { useState } from "react";
import { PerfilCount } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { EmptyState } from "../EmptyState";

/** Donut da distribuição de perfis entre os leads ativos. */
export function PerfilChart({ data }: { data: PerfilCount[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="Sem perfis classificados"
        hint="Quando o robô classificar o perfil dos leads, o gráfico aparece aqui."
      />
    );
  }

  const size = 176;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;

  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = d.count / total;
    const seg = { ...d, i, frac, offset: acc };
    acc += frac;
    return seg;
  });

  const center = active != null ? data[active] : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Distribuição de perfis">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--c-grid-track)"
            strokeWidth={stroke}
          />
          {segs.map((s) => {
            const len = s.frac * C;
            const isActive = active === s.i;
            return (
              <circle
                key={s.key}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={isActive ? stroke + 3 : stroke}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-s.offset * C}
                transform={`rotate(-90 ${c} ${c})`}
                opacity={active == null || isActive ? 1 : 0.4}
                style={{
                  transition: "opacity .2s, stroke-width .2s, filter .2s",
                  filter: isActive ? `drop-shadow(0 0 6px ${s.color}88)` : "none",
                }}
                onMouseEnter={() => setActive(s.i)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tnum font-display text-[26px] font-semibold leading-none text-ink">
            {formatNumber(center ? center.count : total)}
          </span>
          <span className="mt-1 max-w-[104px] text-[11px] leading-tight text-ink-muted">
            {center ? center.label : "leads ativos"}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {segs.map((s) => {
          const pct = (s.count / total) * 100;
          const isActive = active === s.i;
          return (
            <li
              key={s.key}
              onMouseEnter={() => setActive(s.i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1 transition ${
                isActive ? "bg-white/[0.03]" : ""
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-[12.5px] text-ink-muted">{s.label}</span>
              <span className="tnum text-[12.5px] font-semibold text-ink">
                {formatNumber(s.count)}
              </span>
              <span className="tnum w-11 text-right text-[11px] text-ink-faint">
                {formatPercent(pct)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
