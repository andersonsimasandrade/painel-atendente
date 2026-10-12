import Link from "next/link";
import { compararCanais, ROTULO_CANAL, type MetricasCanal } from "@/lib/canais";
import { hojeSP, addDias } from "@/lib/trafego";
import { formatBRL } from "@/lib/format";
import { inicioProjeto } from "@/lib/periodo";
import { SubNav } from "@/components/SubNav";
import { Panel } from "@/components/Panel";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGES: Record<string, { label: string; desde: (h: string) => string }> = {
  "7d": { label: "7 dias", desde: (h) => addDias(h, -7) },
  "30d": { label: "30 dias", desde: (h) => addDias(h, -30) },
  tudo: { label: "Tudo", desde: () => inicioProjeto() },
};

const COR: Record<string, string> = { google: "#4C8DF6", meta: "#35B06E" };

const brl = (v: number | null) => (v == null ? "—" : formatBRL(v));
const num = (v: number | null) => (v == null ? "—" : String(v));
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Coluna({ m }: { m: MetricasCanal }) {
  const pago = m.canal !== "organico";
  const linhas: { rot: string; val: string; dica?: string }[] = [
    { rot: "Investimento", val: pago ? brl(m.investimento) : "—" },
    {
      rot: m.canal === "google" ? "Cliques" : "Conversas iniciadas (Meta)",
      val: m.canal === "google" ? num(m.cliques) : num(m.conversas_plataforma),
    },
    { rot: "Contatos no CRM", val: String(m.capturados) },
    { rot: "Responderam", val: `${m.engajados}${m.capturados ? ` (${Math.round((m.engajados / m.capturados) * 100)}%)` : ""}` },
    { rot: "Agendados", val: String(m.agendados) },
    { rot: "Fechados", val: String(m.fechados) },
    { rot: "Receita", val: brl(m.receita) },
    { rot: "Custo por contato", val: pago ? brl(m.custo_por_captado) : "—" },
    { rot: "CAC real (÷ responderam)", val: pago ? brl(m.cac_real) : "—" },
    { rot: "Custo por agendamento", val: pago ? brl(m.custo_por_agendamento) : "—" },
    { rot: "ROI", val: pago ? pct(m.roi) : "—" },
  ];
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: COR[m.canal] ?? "#8D9A93" }}
          aria-hidden
        />
        <h3 className="font-display text-[16px] font-semibold text-ink">{ROTULO_CANAL[m.canal]}</h3>
      </div>
      <dl className="mt-3 divide-y divide-line text-[13px]">
        {linhas.map((l) => (
          <div key={l.rot} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-ink-muted">{l.rot}</dt>
            <dd className="font-semibold text-ink">{l.val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GastoDia({ dias }: { dias: { data: string; google: number; meta: number }[] }) {
  const max = Math.max(1, ...dias.map((d) => d.google + d.meta));
  const W = 640;
  const H = 130;
  const gap = 3;
  const bw = Math.max(2, (W - gap * (dias.length - 1)) / Math.max(1, dias.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[130px] w-full" preserveAspectRatio="none" role="img" aria-label="Gasto por dia, Google e Meta">
      {dias.map((d, i) => {
        const hg = (d.google / max) * (H - 16);
        const hm = (d.meta / max) * (H - 16);
        const x = i * (bw + gap);
        return (
          <g key={d.data}>
            <rect x={x} y={H - 12 - hm} width={bw} height={hm} fill={COR.meta} opacity="0.8" />
            <rect x={x} y={H - 12 - hm - hg} width={bw} height={hg} fill={COR.google} opacity="0.85" />
          </g>
        );
      })}
    </svg>
  );
}

export default async function ComparativoPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams?.range && RANGES[searchParams.range] ? searchParams.range : "7d";
  const hoje = hojeSP();
  const desde = RANGES[range].desde(hoje);
  const r = await compararCanais(desde, hoje);
  const total = r.canais.reduce((t, c) => t + c.investimento, 0);
  const captados = r.canais.reduce((t, c) => t + c.capturados, 0);

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Google × Meta" subtitle="Comparativo de canais · medido pelo CRM" />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {Object.entries(RANGES).map(([k, rr]) => (
            <Link
              key={k}
              href={`/trafego/comparativo?range=${k}`}
              aria-current={range === k ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                range === k
                  ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
              }`}
            >
              {rr.label}
            </Link>
          ))}
          <Link href="/trafego" className="ml-auto text-[12.5px] text-ink-muted underline-offset-2 hover:underline">
            ← Tráfego (Meta)
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white/[0.02] px-4 py-3.5">
            <p className="font-display text-[22px] font-semibold leading-none text-ink">{formatBRL(total)}</p>
            <p className="mt-1.5 text-[11.5px] text-ink-muted">Investimento total</p>
          </div>
          <div className="rounded-2xl border border-line bg-white/[0.02] px-4 py-3.5">
            <p className="font-display text-[22px] font-semibold leading-none text-ink">{captados}</p>
            <p className="mt-1.5 text-[11.5px] text-ink-muted">Contatos novos no CRM</p>
          </div>
        </div>

        {!r.googleSincronizado && (
          <p className="mt-4 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-[12.5px] text-ink">
            O Google ainda não enviou dados neste período. Isso é normal até o script do Google Ads rodar pela
            primeira vez (ou se a campanha ainda não gastou nada). Os contatos que vieram do Google pelo site já
            aparecem na coluna Google.
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {r.canais.map((c) => (
            <Coluna key={c.canal} m={c} />
          ))}
        </div>

        <Panel title="Gasto por dia" subtitle="Google (azul) + Meta (verde)" className="mt-4" delay={60}>
          <GastoDia dias={r.dias} />
        </Panel>

        <Panel title="Como ler" className="mt-4" delay={100}>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            <li>
              <strong className="text-ink">Investimento</strong> vem de cada plataforma. Todo o resto vem do seu CRM,
              o mesmo critério para os dois canais.
            </li>
            <li>
              <strong className="text-ink">Contatos no CRM</strong> são pessoas que mandaram a primeira mensagem
              no período. O canal é o da primeira origem registrada (anúncio da Meta, site por clique no Google,
              ou nenhum = orgânico).
            </li>
            <li>
              <strong className="text-ink">CAC real</strong> = gasto ÷ quem respondeu ao robô. ROI só aparece quando
              há fechamentos marcados no painel.
            </li>
            <li>
              Amostras pequenas enganam: com poucos contatos, evite decidir só pelo custo. Espere pelo menos 2 semanas
              ou algumas dezenas de contatos por canal.
            </li>
            {r.atualizadoGoogle && (
              <li>Última atualização do Google: {new Date(r.atualizadoGoogle).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</li>
            )}
          </ul>
        </Panel>

        <footer className="mt-8 border-t border-line pt-5 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Comparativo de canais
        </footer>
      </main>
    </div>
  );
}
