import { ReactNode } from "react";
import { getMetaInsights } from "@/lib/meta";
import { getRetorno } from "@/lib/db";
import { formatBRL, formatNumber, formatPercent, shortDay } from "@/lib/format";

type Tone = "default" | "brand" | "amber";

const toneStyles: Record<Tone, { icon: string; accent: string }> = {
  default: { icon: "text-ink-muted bg-surface-3", accent: "before:bg-line-strong" },
  brand: { icon: "text-brand bg-brand/10", accent: "before:bg-brand" },
  amber: { icon: "text-amber bg-amber/10", accent: "before:bg-amber" },
};

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  muted = false,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: Tone;
  muted?: boolean;
  delay?: number;
}) {
  const t = toneStyles[tone];
  return (
    <div
      className={`card-surface grain-none animate-fade-up relative h-full overflow-hidden rounded-2xl border border-line p-4 shadow-card before:absolute before:left-0 before:top-4 before:h-[calc(100%-2rem)] before:w-[3px] before:rounded-full ${t.accent}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2 pl-2">
        <p className="text-[11.5px] font-medium uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${muted ? "text-ink-faint bg-surface-3" : t.icon}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 pl-2">
        <div
          className={`tnum font-display text-[26px] font-semibold leading-none tracking-tight sm:text-[28px] ${muted ? "text-ink-faint" : "text-ink"}`}
        >
          {value}
        </div>
        {sub && <p className="mt-1.5 text-[11.5px] text-ink-muted">{sub}</p>}
      </div>
    </div>
  );
}

// Faixa-destaque do ROI: verde no lucro, vermelho no prejuízo, neutro quando
// não é possível calcular (Meta indisponível ou investimento zero).
function RoiHero({
  roi,
  receita,
  investimento,
  computavel,
}: {
  roi: number;
  receita: number;
  investimento: number;
  computavel: boolean;
}) {
  const positivo = roi >= 0;
  const lucro = receita - investimento;

  // Cores por token: no tema claro o coral cru some sobre branco, e o número do
  // prejuízo é justamente o que a diretoria abre esta tela pra ver.
  const accent = !computavel
    ? "rgb(var(--c-ink-faint-rgb))"
    : positivo
      ? "#35B06E"
      : "var(--c-danger)";
  const valueColor = !computavel
    ? "text-ink-faint"
    : positivo
      ? "text-brand"
      : "text-danger";

  return (
    <div
      className="card-surface grain-none animate-fade-up relative overflow-hidden rounded-2xl border border-line p-5 shadow-card sm:p-6"
      style={{ animationDelay: "110ms" }}
    >
      {/* brilho ambiente na cor do resultado */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={
                    positivo || !computavel
                      ? "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"
                      : "M3 7l6 6 4-4 8 8m0 0h-5m5 0v-5"
                  }
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Retorno sobre investimento
            </p>
          </div>
          <div
            className={`tnum mt-3 font-display text-[46px] font-bold leading-none tracking-tight sm:text-[56px] ${valueColor}`}
          >
            {computavel ? formatPercent(roi, 1) : "—"}
          </div>
          <p className="mt-2 max-w-md text-[12px] text-ink-muted">
            {computavel
              ? "(Receita − Investimento) ÷ Investimento"
              : investimento <= 0
                ? "Sem investimento de anúncios no período para calcular o ROI."
                : "ROI indisponível enquanto os dados da Meta não carregam."}
          </p>
        </div>

        {/* Decomposição: Receita − Investimento = Lucro */}
        <div className="flex items-stretch gap-0 rounded-xl border border-line bg-base/40">
          <HeroCell label="Receita" value={formatBRL(receita)} color="text-brand" />
          <HeroDivider op="−" />
          <HeroCell
            label="Investimento"
            value={computavel || investimento > 0 ? formatBRL(investimento) : "—"}
            color="text-amber"
          />
          <HeroDivider op="=" />
          <HeroCell
            label={lucro >= 0 ? "Lucro" : "Prejuízo"}
            value={computavel ? formatBRL(lucro) : "—"}
            color={!computavel ? "text-ink-faint" : lucro >= 0 ? "text-brand" : "text-danger"}
          />
        </div>
      </div>
    </div>
  );
}

function HeroCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex min-w-[92px] flex-col justify-center px-3.5 py-3 sm:px-4">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className={`tnum mt-1 font-display text-[15px] font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}

function HeroDivider({ op }: { op: string }) {
  return (
    <div className="flex items-center border-l border-line px-1 text-[13px] text-ink-faint">
      {op}
    </div>
  );
}

function MetaNotice({ error }: { error: string }) {
  return (
    <div
      className="animate-fade-up mb-3.5 flex items-start gap-3 rounded-xl border border-amber/25 bg-amber/[0.06] px-4 py-3"
      style={{ animationDelay: "90ms" }}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/10 text-amber">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">Dados da Meta indisponíveis</p>
        <p className="mt-0.5 break-words text-[12px] text-ink-muted">{error}</p>
      </div>
    </div>
  );
}

export async function TrafegoRetorno({
  botLeads,
  desde,
  ate,
}: {
  botLeads: number;
  desde: string;
  ate: string;
}) {
  // Ambos escopados à janela selecionada: investimento (Meta) e receita
  // (fechados por data_fechamento) no mesmo período → ROI coerente.
  const [meta, retornoRes] = await Promise.all([
    getMetaInsights(desde, ate),
    getRetorno(desde, ate),
  ]);

  const ret = retornoRes.ok
    ? retornoRes.retorno
    : { fechados: 0, receita: 0, ticketMedio: 0 };

  const metaOk = meta.ok;
  const investimento = metaOk ? meta.investimento : 0;
  const roiComputavel = metaOk && investimento > 0;
  const roi = roiComputavel ? ((ret.receita - investimento) / investimento) * 100 : 0;

  return (
    <section aria-label="Tráfego e retorno" className="mt-8">
      {/* Cabeçalho da seção */}
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full bg-brand" aria-hidden="true" />
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-tight text-ink">
              Tráfego &amp; Retorno
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Investimento em anúncios (Meta) e retorno dos negócios fechados no período
            </p>
          </div>
        </div>
        <span className="tnum rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
          {shortDay(desde)} — {shortDay(ate)}
        </span>
      </div>

      {!metaOk && <MetaNotice error={meta.error} />}

      <RoiHero
        roi={roi}
        receita={ret.receita}
        investimento={investimento}
        computavel={roiComputavel}
      />

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Investimento"
          value={metaOk ? formatBRL(meta.investimento) : "—"}
          sub="anúncios (Meta)"
          tone="amber"
          muted={!metaOk}
          delay={140}
          icon={<IconWallet />}
        />
        <StatCard
          label="Leads do anúncio"
          value={metaOk ? formatNumber(meta.leads) : "—"}
          sub="conversas iniciadas"
          tone="brand"
          muted={!metaOk}
          delay={180}
          icon={<IconMegaphone />}
        />
        <StatCard
          label="CAC"
          value={metaOk ? formatBRL(meta.cac) : "—"}
          sub="custo por lead"
          tone="default"
          muted={!metaOk}
          delay={220}
          icon={<IconTag />}
        />
        <StatCard
          label="Leads no bot"
          value={formatNumber(botLeads)}
          sub="engajados (ativos)"
          tone="default"
          delay={260}
          icon={<IconChat />}
        />
        <StatCard
          label="Fechados"
          value={formatNumber(ret.fechados)}
          sub="ganhos no período"
          tone="brand"
          delay={300}
          icon={<IconHandshake />}
        />
        <StatCard
          label="Receita"
          value={formatBRL(ret.receita)}
          sub={ret.fechados > 0 ? `ticket ${formatBRL(ret.ticketMedio)}` : "nenhum fechado ainda"}
          tone="brand"
          delay={340}
          icon={<IconCoins />}
        />
      </div>

      {/* Detalhe por campanha (quando há dados da Meta) */}
      {metaOk && meta.porCampanha.length > 0 && (
        <div
          className="card-surface grain-none animate-fade-up mt-3.5 overflow-hidden rounded-2xl border border-line shadow-card"
          style={{ animationDelay: "380ms" }}
        >
          <div className="flex items-center justify-between px-5 pt-4 sm:px-6">
            <h3 className="font-display text-[13.5px] font-semibold tracking-tight text-ink">
              Por campanha
            </h3>
            <span className="text-[11px] text-ink-faint">
              {formatNumber(meta.porCampanha.length)}{" "}
              {meta.porCampanha.length === 1 ? "campanha" : "campanhas"}
            </span>
          </div>
          <div className="scroll-slim overflow-x-auto px-2 pb-3 pt-2 sm:px-3">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                  <th className="px-3 py-2 font-medium">Campanha</th>
                  <th className="px-3 py-2 text-right font-medium">Investimento</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">CAC</th>
                </tr>
              </thead>
              <tbody>
                {meta.porCampanha.map((c) => (
                  <tr
                    key={c.nome}
                    className="border-t border-line/70 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-[12.5px] text-ink">
                      {c.nome}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[12.5px] text-ink-muted">
                      {formatBRL(c.spend)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[12.5px] font-semibold text-ink">
                      {formatNumber(c.leads)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[12.5px] text-ink-muted">
                      {c.leads > 0 ? formatBRL(c.cac) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
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

function IconWallet() {
  return (
    <svg {...sIcon}>
      <path
        d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2m2 3h-4a2 2 0 0 0 0 4h4M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M3 8h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconMegaphone() {
  return (
    <svg {...sIcon}>
      <path
        d="M3 11v2a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.7-.7V7.2a1 1 0 0 0-1.7-.7L6 10H4a1 1 0 0 0-1 1Zm12-4a5 5 0 0 1 0 10M7 14v3.5a1.5 1.5 0 0 0 3 0V15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconTag() {
  return (
    <svg {...sIcon}>
      <path
        d="M3.5 12.3 11 4.8a2 2 0 0 1 1.4-.6l4.6-.2a2 2 0 0 1 2 2l-.2 4.6a2 2 0 0 1-.6 1.4l-7.5 7.5a2 2 0 0 1-2.8 0l-4.4-4.4a2 2 0 0 1 0-2.8ZM15.5 8.5h.01"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChat() {
  return (
    <svg {...sIcon}>
      <path
        d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 4.5h8M8 12.5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconHandshake() {
  return (
    <svg {...sIcon}>
      <path
        d="m11 17 2 2a1.4 1.4 0 0 0 2-2l-1-1 1 1a1.4 1.4 0 0 0 2-2l-4-4-2-1.5-3 1.5m5 6-3-3M3 7l3-1 5 3m-8 5 3 3M3 7v6l2 2m14-8-3-1-3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCoins() {
  return (
    <svg {...sIcon}>
      <path
        d="M8 8.5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5S17.3 11 14 11 8 9.9 8 8.5Zm0 0v7c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-7M4 11.5C4 10.1 5.3 9 7 8.6M4 11.5v7c0 1.4 1.8 2.5 4 2.5 1 0 1.9-.2 2.6-.5M4 15c0 1.2 1.4 2.2 3.2 2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
