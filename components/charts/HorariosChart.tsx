"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HoraCount } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "../EmptyState";

const HEIGHT = 210;
const PAD = { top: 16, right: 10, bottom: 26, left: 10 };

/**
 * Melhores horários (Feature 4). Barras verticais de leads por hora do dia
 * (0–23), fuso America/Sao_Paulo. A(s) hora(s) de pico ficam realçadas em verde
 * vivo; as demais em verde suave. Sem tempo de resposta (não há timestamp por
 * mensagem) — apenas o horário da primeira interação.
 */
export function HorariosChart({ data }: { data: HoraCount[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.round(w)));
    });
    ro.observe(el);
    setWidth(Math.max(320, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...data.map((d) => d.count), 1);
  const niceMax = niceCeil(max);
  const peakHoras = useMemo(
    () => (max > 0 ? data.filter((d) => d.count === max).map((d) => d.hora) : []),
    [data, max],
  );
  const peakSet = useMemo(() => new Set(peakHoras), [peakHoras]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / 24;
  const barW = Math.max(4, slot * 0.62);
  const x = (h: number) => PAD.left + slot * h + (slot - barW) / 2;
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  if (total === 0) {
    return (
      <EmptyState
        title="Sem horários ainda"
        hint="Quando os leads chegarem no período, a distribuição por hora aparece aqui."
      />
    );
  }

  function onMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const h = Math.floor((px - PAD.left) / (slot || 1));
    setHover(Math.max(0, Math.min(23, h)));
  }

  const gridVals = [0, niceMax / 2, niceMax];

  return (
    <div className="w-full">
      <div
        ref={wrapRef}
        className="relative w-full select-none"
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width={width}
          height={HEIGHT}
          onMouseMove={onMove}
          role="img"
          aria-label="Leads por hora do dia (fuso de São Paulo)"
        >
          <defs>
            <linearGradient id="hora-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#35B06E" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#18C88C" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="hora-bar-peak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52C98A" stopOpacity="1" />
              <stop offset="100%" stopColor="#35B06E" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="hora-bar-dim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E8C74" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2E8C74" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* gridlines + rótulos do eixo Y */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--c-grid)"
                strokeWidth={1}
                strokeDasharray={i === 0 ? "0" : "3 4"}
              />
              <text
                x={PAD.left + innerW}
                y={y(v) - 4}
                textAnchor="end"
                className="fill-ink-faint font-mono"
                style={{ fontSize: 10 }}
              >
                {formatNumber(Math.round(v))}
              </text>
            </g>
          ))}

          {/* barras */}
          {data.map((d) => {
            const h = d.count > 0 ? Math.max(2, PAD.top + innerH - y(d.count)) : 0;
            const isPeak = peakSet.has(d.hora);
            const isHover = hover === d.hora;
            const fill = isPeak
              ? "url(#hora-bar-peak)"
              : isHover
                ? "url(#hora-bar)"
                : "url(#hora-bar-dim)";
            return (
              <rect
                key={d.hora}
                x={x(d.hora)}
                y={PAD.top + innerH - h}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                fill={d.count > 0 ? fill : "transparent"}
                style={{ transition: "y .3s, height .3s" }}
              />
            );
          })}

          {/* rótulos do eixo X (de 3 em 3 horas) */}
          {data.map((d) =>
            d.hora % 3 === 0 ? (
              <text
                key={d.hora}
                x={x(d.hora) + barW / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-ink-faint font-mono"
                style={{ fontSize: 10 }}
              >
                {d.hora}h
              </text>
            ) : null,
          )}
        </svg>

        {/* tooltip */}
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-elevated/95 px-3 py-2 shadow-card backdrop-blur"
            style={{
              left: Math.min(Math.max(x(hover) + barW / 2, 60), width - 60),
              top: y(data[hover].count) - 6,
            }}
          >
            <div className="tnum text-[11px] text-ink-faint">
              {String(hover).padStart(2, "0")}h–{String((hover + 1) % 24).padStart(2, "0")}h
            </div>
            <div className="tnum text-[14px] font-semibold text-ink">
              {formatNumber(data[hover].count)}{" "}
              <span className="text-[11px] font-normal text-ink-muted">
                {data[hover].count === 1 ? "lead" : "leads"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* legenda de pico */}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-[12px]">
        <span className="text-ink-muted">Horário de pico</span>
        <span className="tnum font-display text-[14px] font-semibold text-brand">
          {peakHoras.length
            ? peakHoras.map((h) => `${h}h`).join(", ")
            : "—"}
        </span>
      </div>
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
