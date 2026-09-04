import Link from "next/link";
import { lerTrafego, agregarPeriodo, porCampanhaCompleto, hojeSP, addDias } from "@/lib/trafego";
import { formatBRL } from "@/lib/format";
import { inicioProjeto } from "@/lib/periodo";
import { SubNav } from "@/components/SubNav";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGES: Record<string, { label: string; desde: (h: string) => string }> = {
  "7d": { label: "7 dias", desde: (h) => addDias(h, -7) },
  "30d": { label: "30 dias", desde: (h) => addDias(h, -30) },
  tudo: { label: "Tudo", desde: () => inicioProjeto() },
};

function Kpi({ v, label, tone }: { v: string; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] px-4 py-3.5">
      <p className={`font-display text-[22px] font-semibold leading-none ${tone ?? "text-ink"}`}>{v}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-muted">{label}</p>
    </div>
  );
}

// Barras de gasto/dia (SVG server-rendered).
function GastoChart({ dias }: { dias: { data: string; investimento: number }[] }) {
  if (!dias.length) return null;
  const max = Math.max(1, ...dias.map((d) => d.investimento));
  const W = 640;
  const H = 120;
  const gap = 3;
  const bw = Math.max(2, (W - gap * (dias.length - 1)) / dias.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" preserveAspectRatio="none" role="img" aria-label="Gasto por dia">
      {dias.map((d, i) => {
        const h = (d.investimento / max) * (H - 18);
        return (
          <g key={d.data}>
            <rect x={i * (bw + gap)} y={H - h - 14} width={bw} height={h} rx="1.5" fill="#35B06E" opacity="0.75" />
          </g>
        );
      })}
    </svg>
  );
}

export default async function TrafegoPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams?.range && RANGES[searchParams.range] ? searchParams.range : "7d";
  const hoje = hojeSP();
  const desde = RANGES[range].desde(hoje);
  const dias = await lerTrafego(desde, hoje);
  const m = agregarPeriodo(dias);
  const campanhas = await porCampanhaCompleto(m.por_campanha, desde, hoje);
  const roi = m.roi == null ? "—" : `${Math.round(m.roi * 100)}%`;
  const pctEng = m.novos_leads > 0 ? Math.round((m.engajados / m.novos_leads) * 100) : 0;
  const temDados = dias.length > 0;

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Tráfego" subtitle="Retorno dos anúncios · Meta × nosso bot" />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* seletor de período */}
        <div className="mb-4 flex items-center gap-1.5">
          {Object.entries(RANGES).map(([k, r]) => (
            <Link
              key={k}
              href={`/trafego?range=${k}`}
              aria-current={range === k ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                range === k
                  ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        {!temDados ? (
          <Panel>
            <EmptyState
              title="Ainda sem dados de tráfego"
              hint="Os números chegam quando a rotina diária de tráfego roda (veja PAINEL-INTEGRACAO.md). Você também pode disparar o cron na mão para ver agora."
            />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Kpi v={formatBRL(m.investimento)} label="Investimento (Meta)" />
              <Kpi v={String(m.leads_meta)} label={`Leads · CPL ${formatBRL(m.cpl_meta)}`} tone="text-brand" />
              <Kpi v={`${m.engajados}/${m.novos_leads}`} label={`Responderam no bot (${pctEng}%)`} />
              <Kpi v={formatBRL(m.cac_real)} label="CAC real (÷ quem respondeu)" tone="text-brand" />
              <Kpi v={String(m.agendados)} label="Agendados" />
              <Kpi v={String(m.materiais)} label="Materiais enviados" />
              <Kpi v={String(m.fechados)} label={`Fechados · ${formatBRL(m.receita)}`} tone={m.fechados ? "text-brand" : "text-ink"} />
              <Kpi v={roi} label="ROI" tone={m.roi != null && m.roi > 0 ? "text-brand" : "text-ink"} />
            </div>

            <Panel title="Gasto por dia" className="mt-4" delay={60}>
              <GastoChart dias={m.dias} />
            </Panel>

            <Panel
              title="Por campanha"
              subtitle="Meta (gasto/leads/CPL) × nosso bot (responderam/CAC real/ROI)"
              className="mt-4"
              delay={100}
            >
              {campanhas.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                        <th className="pb-2 font-medium">Campanha</th>
                        <th className="pb-2 text-right font-medium">Gasto</th>
                        <th className="pb-2 text-right font-medium">Leads (Meta)</th>
                        <th className="pb-2 text-right font-medium">CPL</th>
                        <th className="pb-2 text-right font-medium">Responderam</th>
                        <th className="pb-2 text-right font-medium">CAC real</th>
                        <th className="pb-2 text-right font-medium">Fechados</th>
                        <th className="pb-2 text-right font-medium">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {campanhas.map((c) => (
                        <tr key={c.nome}>
                          <td className="py-2 pr-2 text-ink">{c.nome}</td>
                          <td className="py-2 text-right text-ink-muted">{formatBRL(c.spend)}</td>
                          <td className="py-2 text-right text-ink-muted">{c.leads_meta}</td>
                          <td className="py-2 text-right text-ink-muted">{formatBRL(c.cpl_meta)}</td>
                          <td className="py-2 text-right text-ink-muted">
                            {c.engajados}/{c.capturados}
                          </td>
                          <td className="py-2 text-right text-ink-muted">
                            {c.engajados > 0 ? formatBRL(c.cac_real) : "—"}
                          </td>
                          <td className="py-2 text-right text-ink-muted">{c.fechados}</td>
                          <td className="py-2 text-right text-ink-muted">
                            {c.roi == null ? "—" : `${Math.round(c.roi * 100)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-ink-faint">Nenhuma campanha com gasto no período.</p>
              )}
              <p className="mt-3 text-[11px] text-ink-faint">
                "Responderam" e ROI por campanha enchem conforme os leads de anúncio chegam com atribuição
                (a partir de agora). Leads antigos não têm origem.
              </p>
            </Panel>

            <Panel title="Funil do nosso bot" subtitle="do clique no anúncio ao fechamento" className="mt-4" delay={140}>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                {[
                  { l: "Leads (Meta)", v: m.leads_meta },
                  { l: "Capturados", v: m.novos_leads },
                  { l: "Responderam", v: m.engajados },
                  { l: "Agendados", v: m.agendados },
                  { l: "Materiais", v: m.materiais },
                  { l: "Fechados", v: m.fechados },
                ].map((s, i, arr) => (
                  <span key={s.l} className="flex items-center gap-2">
                    <span className="rounded-lg border border-line bg-white/[0.02] px-3 py-1.5">
                      <span className="font-semibold text-ink">{s.v}</span>{" "}
                      <span className="text-ink-muted">{s.l}</span>
                    </span>
                    {i < arr.length - 1 && <span className="text-ink-faint">›</span>}
                  </span>
                ))}
              </div>
            </Panel>
          </>
        )}

        <footer className="mt-8 border-t border-line pt-5 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Tráfego — resumo diário · leads = conversas de WhatsApp iniciadas (Meta)
        </footer>
      </main>
    </div>
  );
}
