import { ReactNode } from "react";
import Link from "next/link";
import { Kpis } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";

type Tone = "default" | "brand" | "amber";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: Tone;
  delay?: number;
  meter?: number; // 0..100 opcional (barra fina)
  href: string; // destino: /leads?filtro=…
}

const toneStyles: Record<Tone, { icon: string; accent: string; meter: string }> = {
  default: {
    icon: "text-ink-muted bg-surface-3",
    accent: "before:bg-line-strong",
    meter: "bg-ink-faint",
  },
  brand: {
    icon: "text-brand bg-brand/10",
    accent: "before:bg-brand",
    meter: "bg-brand",
  },
  amber: {
    icon: "text-amber bg-amber/10",
    accent: "before:bg-amber",
    meter: "bg-amber",
  },
};

function KpiCard({ label, value, sub, icon, tone = "default", delay = 0, meter, href }: KpiCardProps) {
  const t = toneStyles[tone];
  return (
    <Link
      href={href}
      className="group animate-fade-up block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`card-surface grain-none relative h-full overflow-hidden rounded-2xl border border-line p-4 shadow-card transition duration-200 group-hover:-translate-y-[2px] group-hover:border-line-strong sm:p-5 before:absolute before:left-0 before:top-4 before:h-[calc(100%-2rem)] before:w-[3px] before:rounded-full before:transition-[height] ${t.accent} group-hover:before:h-[calc(100%-1.5rem)]`}
      >
        <div className="flex items-start justify-between gap-2 pl-2">
          <p className="text-[12px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
            {icon}
          </span>
        </div>
        <div className="mt-2 pl-2">
          <div className="tnum font-display text-[30px] font-semibold leading-none tracking-tight text-ink sm:text-[34px]">
            {value}
          </div>
          {sub && <p className="mt-1.5 text-[12px] text-ink-muted">{sub}</p>}
        </div>
        {typeof meter === "number" && (
          <div className="mt-3 h-1 w-[calc(100%-0.5rem)] overflow-hidden rounded-full bg-white/[0.04] ml-2">
            <div
              className={`h-full rounded-full ${t.meter} animate-grow origin-left`}
              style={{ width: `${Math.max(2, Math.min(100, meter))}%` }}
            />
          </div>
        )}
        {/* Afeto de clique: seta que desliza ao passar o mouse */}
        <span
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 translate-x-1 text-ink-faint opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:text-ink-muted group-hover:opacity-100"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14m0 0-5-5m5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Leads ativos"
        value={formatNumber(kpis.ativos)}
        sub="captados via anúncio"
        tone="default"
        delay={0}
        href="/leads?filtro=ativos"
        icon={<IconUsers />}
      />
      <KpiCard
        label="Agendados"
        value={formatNumber(kpis.agendados)}
        sub="reuniões marcadas"
        tone="brand"
        delay={50}
        href="/leads?filtro=agendados"
        icon={<IconCalendar />}
      />
      <KpiCard
        label="Conversão"
        value={formatPercent(kpis.conversao)}
        sub="agendados / ativos"
        tone="brand"
        delay={100}
        meter={kpis.conversao}
        href="/leads?filtro=agendados"
        icon={<IconTarget />}
      />
      <KpiCard
        label="Materiais enviados"
        value={formatNumber(kpis.materiais)}
        sub="catálogo & política"
        tone="default"
        delay={150}
        href="/leads?filtro=materiais"
        icon={<IconDoc />}
      />
      <KpiCard
        label="Follow-ups"
        value={formatNumber(kpis.followups)}
        sub="reengajamentos"
        tone="default"
        delay={200}
        href="/leads?filtro=followups"
        icon={<IconReply />}
      />
      <KpiCard
        label="Leads parados"
        value={formatNumber(kpis.parados)}
        sub="ativos, +24h sem resposta"
        tone={kpis.parados > 0 ? "amber" : "default"}
        delay={250}
        href="/leads?filtro=parados"
        icon={<IconClock />}
      />
    </div>
  );
}

/* ── Ícones (stroke 1.6, 18px) ─────────────────────────────────────────── */
const sIcon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
} as const;

function IconUsers() {
  return (
    <svg {...sIcon}>
      <path
        d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m18 0v-1.5a3.5 3.5 0 0 0-2.7-3.4M15 4.2a3.5 3.5 0 0 1 0 6.6M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg {...sIcon}>
      <path
        d="M8 3v3m8-3v3M4 8.5h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4.5 9 2 2 3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg {...sIcon}>
      <path
        d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5m-5-1 5-5m0 0V3.5m0 2.5h2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg {...sIcon}>
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4M8 13h8M8 17h5M7 3h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconReply() {
  return (
    <svg {...sIcon}>
      <path
        d="M9 10 4 15l5 5M4 15h11a5 5 0 0 0 5-5V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconClock() {
  return (
    <svg {...sIcon}>
      <path
        d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
