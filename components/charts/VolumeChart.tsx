"use client";

import { useEffect, useRef, useState } from "react";
import { DayCount } from "@/lib/types";
import { formatNumber, shortDay } from "@/lib/format";

const HEIGHT = 210;
const PAD = { top: 18, right: 14, bottom: 26, left: 14 };

export function VolumeChart({ data }: { data: DayCount[] }) {
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
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const niceMax = niceCeil(maxVal);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const n = data.length;

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(" ");
  const areaPts = `${PAD.left},${PAD.top + innerH} ${linePts} ${PAD.left + innerW},${
    PAD.top + innerH
  }`;

  const gridVals = [0, niceMax / 2, niceMax];

  function onMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const rel = (px - PAD.left) / (innerW || 1);
    const idx = Math.round(rel * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <div ref={wrapRef} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={HEIGHT}
        onMouseMove={onMove}
        role="img"
        aria-label="Volume de eventos por dia (14 dias)"
      >
        <defs>
          <linearGradient id="vol-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35B06E" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#35B06E" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#35B06E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vol-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#18C88C" />
            <stop offset="100%" stopColor="#52C98A" />
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

        {total > 0 && (
          <>
            <polygon points={areaPts} fill="url(#vol-area)" />
            <polyline
              points={linePts}
              fill="none"
              stroke="url(#vol-line)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* rótulos do eixo X (dias ímpares -> inclui o dia de hoje, sem colisão) */}
        {data.map((d, i) =>
          i % 2 === 1 ? (
            <text
              key={d.day}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-faint font-mono"
              style={{ fontSize: 10 }}
            >
              {shortDay(d.day)}
            </text>
          ) : null,
        )}

        {/* pontos */}
        {total > 0 &&
          data.map((d, i) => (
            <circle
              key={d.day}
              cx={x(i)}
              cy={y(d.count)}
              r={hover === i ? 4.5 : 2.4}
              fill={hover === i ? "#52C98A" : "#18C88C"}
              stroke="var(--c-chart-dot-stroke)"
              strokeWidth={hover === i ? 2 : 0}
            />
          ))}

        {/* crosshair */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--c-grid-strong)"
            strokeWidth={1}
          />
        )}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-elevated/95 px-3 py-2 shadow-card backdrop-blur"
          style={{
            left: Math.min(Math.max(x(hover), 60), width - 60),
            top: y(data[hover].count) - 6,
          }}
        >
          <div className="text-[11px] text-ink-faint">
            {new Date(data[hover].day + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </div>
          <div className="tnum text-[14px] font-semibold text-ink">
            {formatNumber(data[hover].count)}{" "}
            <span className="text-[11px] font-normal text-ink-muted">eventos</span>
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[12.5px] text-ink-faint">Sem eventos nos últimos 14 dias</span>
        </div>
      )}
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
