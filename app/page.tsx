import { getDashboardData, getPeriodStats, getMelhoresHorarios } from "@/lib/db";
import { resolvePeriodo } from "@/lib/periodo";
import { formatNumber, formatDateTime } from "@/lib/format";
import { Header } from "@/components/Header";
import { DateFilter } from "@/components/DateFilter";
import { KpiRow } from "@/components/KpiRow";
import { Panel } from "@/components/Panel";
import { TrafegoRetorno } from "@/components/TrafegoRetorno";
import { DbErrorState } from "@/components/DbErrorState";
import { RecentActivity } from "@/components/RecentActivity";
import { LeadsTable } from "@/components/LeadsTable";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { StageBarChart } from "@/components/charts/StageBarChart";
import { VolumeChart } from "@/components/charts/VolumeChart";
import { PerfilChart } from "@/components/charts/PerfilChart";
import { RegiaoChart } from "@/components/charts/RegiaoChart";
import { HorariosChart } from "@/components/charts/HorariosChart";
import { empresaNome } from "@/lib/config";

// Números sempre ao vivo: nada de cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
      {children}
    </span>
  );
}

type SearchParams = {
  periodo?: string | string[];
  de?: string | string[];
  ate?: string | string[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Feature 1: o período afeta APENAS métricas de janela. As leituras de
  // "estado atual" (getDashboardData) seguem sempre ao vivo / all-time.
  const periodo = resolvePeriodo(searchParams);

  const [result, periodStatsRes, horariosRes] = await Promise.all([
    getDashboardData(),
    getPeriodStats(periodo.desde, periodo.ate),
    getMelhoresHorarios(periodo.desde, periodo.ate),
  ]);

  if (!result.ok) {
    return <DbErrorState error={result.error} />;
  }

  const {
    kpis,
    funnel,
    stageDistribution,
    perfilDistribution,
    regiaoDistribution,
    recentEvents,
    volume,
    leads,
    generatedAt,
  } = result.data;
  const volumeTotal = volume.reduce((s, d) => s + d.count, 0);
  const perfilTotal = perfilDistribution.reduce((s, p) => s + p.count, 0);
  const regiaoTotal = regiaoDistribution.reduce((s, r) => s + r.count, 0);

  const leadsNovos = periodStatsRes.ok ? periodStatsRes.stats.leadsNovos : null;
  const horas = horariosRes.ok ? horariosRes.horas : [];
  const horasTotal = horariosRes.ok ? horariosRes.total : 0;

  return (
    <div className="relative z-[1] min-h-screen">
      <Header generatedAt={generatedAt} />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Filtro de período (escopo: métricas de janela) */}
        <section
          aria-label="Período"
          className="mb-4 flex flex-wrap items-center justify-between gap-3"
        >
          <DateFilter
            preset={periodo.preset}
            desde={periodo.desde}
            ate={periodo.ate}
            de={periodo.de}
            ateInput={periodo.ateInput}
          />
          {leadsNovos != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-3 py-1.5 text-[12px] text-ink-muted">
              <span className="tnum font-display font-semibold text-brand">
                {formatNumber(leadsNovos)}
              </span>
              novos no período
            </span>
          )}
        </section>

        {/* Tráfego & Retorno PRIMEIRO: "estamos ganhando dinheiro?" é a pergunta
            que a diretoria abre o painel pra responder. Escopado ao período. */}
        <TrafegoRetorno botLeads={kpis.ativos} desde={periodo.desde} ate={periodo.ate} />

        {/* KPIs operacionais — estado atual, sempre ao vivo (não escopado ao período) */}
        <section aria-label="Indicadores" className="mt-4">
          <KpiRow kpis={kpis} />
        </section>

        {/* Funil + Distribuição */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Panel
            title="Funil de conversão"
            subtitle="Quantos leads chegaram até cada etapa"
            action={<Pill>{formatNumber(funnel[0]?.count ?? 0)} no topo</Pill>}
            className="lg:col-span-7"
            delay={120}
          >
            <FunnelChart steps={funnel} />
          </Panel>

          <Panel
            title="Distribuição por estágio"
            subtitle="Leads no estágio atual"
            className="lg:col-span-5"
            delay={180}
          >
            <StageBarChart stages={stageDistribution} />
          </Panel>
        </div>

        {/* Perfil + Região (Fase 3) */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Panel
            title="Perfil dos leads"
            subtitle="Distribuição entre os leads ativos"
            action={<Pill>{formatNumber(perfilTotal)} classificados</Pill>}
            className="lg:col-span-6"
            delay={300}
          >
            <PerfilChart data={perfilDistribution} />
          </Panel>

          <Panel
            title="Leads por região"
            subtitle="Estados com mais leads ativos (UF)"
            action={<Pill>{formatNumber(regiaoTotal)} leads</Pill>}
            className="lg:col-span-6"
            delay={340}
          >
            <RegiaoChart data={regiaoDistribution} />
          </Panel>
        </div>

        {/* Comportamento: melhores horários (escopado ao período) */}
        <div className="mt-4">
          <Panel
            title="Melhores horários"
            subtitle="Leads por hora do dia — primeira interação (fuso de São Paulo)"
            action={<Pill>{formatNumber(horasTotal)} no período</Pill>}
            delay={280}
          >
            <HorariosChart data={horas} />
          </Panel>
        </div>

        {/* Volume + Atividade recente */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Panel
            title="Atividade por dia"
            subtitle="Eventos do funil — janela fixa de 14 dias (não segue o filtro acima)"
            action={<Pill>{formatNumber(volumeTotal)} eventos</Pill>}
            className="lg:col-span-7"
            delay={220}
          >
            <VolumeChart data={volume} />
          </Panel>

          <Panel
            title="Atividade recente"
            subtitle="Últimas respostas do robô"
            action={<Pill>{recentEvents.length}</Pill>}
            className="lg:col-span-5"
            delay={260}
          >
            <RecentActivity events={recentEvents} />
          </Panel>
        </div>

        {/* Tabela de leads */}
        <div className="mt-4">
          <Panel
            title="Leads ativos"
            subtitle="Ordenados pela última interação"
            action={<Pill>{formatNumber(leads.length)} leads</Pill>}
            delay={300}
          >
            <LeadsTable leads={leads} />
          </Panel>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-ink-faint sm:flex-row">
          <span>
            {empresaNome()} · Painel de leads — dados ao vivo do Supabase
          </span>
          <span className="tnum">Última leitura: {formatDateTime(generatedAt)}</span>
        </footer>
      </main>
    </div>
  );
}
