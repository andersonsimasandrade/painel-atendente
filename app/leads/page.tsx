import { getLeads } from "@/lib/db";
import { getEtapas } from "@/lib/funil";
import { LeadsQuery } from "@/lib/types";
import { formatNumber, formatDateTime } from "@/lib/format";
import { SubNav } from "@/components/SubNav";
import { LiveStatus } from "@/components/LiveStatus";
import { Panel } from "@/components/Panel";
import { DbErrorState } from "@/components/DbErrorState";
import { LeadsFilterBar } from "@/components/LeadsFilterBar";
import { LeadsDirectory } from "@/components/LeadsDirectory";
import { LeadsOrigem } from "@/components/LeadsOrigem";
import { FiltroConsultor } from "@/components/FiltroConsultor";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";
import { listarVendedores } from "@/lib/agenda";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
      {children}
    </span>
  );
}

// Coage um parâmetro (string | string[] | undefined) em string simples.
function sp(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

type SearchParams = {
  filtro?: string | string[];
  busca?: string | string[];
  perfil?: string | string[];
  uf?: string | string[];
  cnpj?: string | string[];
  estagio?: string | string[];
  campanha?: string | string[];
  resultado?: string | string[];
  de?: string | string[];
  ate?: string | string[];
  consultor?: string | string[];
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Escopo: consultor vê só os leads dele; admin vê todos (ou filtra por ?consultor=).
  const sess = await getSessao();
  const dono = escopoDaLista(sess, sp(searchParams.consultor));
  const query: LeadsQuery = {
    filtro: sp(searchParams.filtro),
    busca: sp(searchParams.busca),
    perfil: sp(searchParams.perfil),
    uf: sp(searchParams.uf),
    cnpj: sp(searchParams.cnpj),
    estagio: sp(searchParams.estagio),
    campanha: sp(searchParams.campanha),
    resultado: sp(searchParams.resultado),
    de: sp(searchParams.de),
    ate: sp(searchParams.ate),
    dono,
  };

  const [result, consultores, etapas] = await Promise.all([
    getLeads(query),
    // Fail-closed: só admin recebe o roster (sessão revogada/papel novo, não).
    sess?.papel === "admin" ? listarVendedores() : Promise.resolve([]),
    getEtapas(),
  ]);

  if (!result.ok) {
    return <DbErrorState error={result.error} />;
  }

  const { leads, total, ufs, campanhas, porUf, porCidade, desfechos, generatedAt } = result;

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title="Leads"
        subtitle="Base completa de captação"
        right={
          <>
            <FiltroConsultor consultores={consultores} atual={sp(searchParams.consultor)} />
            <LiveStatus generatedAt={generatedAt} />
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Panel
          title="Filtrar leads"
          subtitle="Busque por nome ou telefone e refine por situação, categoria, estágio, UF, CNPJ, desfecho e data de entrada"
          delay={80}
        >
          <LeadsFilterBar initial={query} ufs={ufs} campanhas={campanhas} etapas={etapas} />
        </Panel>

        <div className="mt-4">
          <Panel
            title="De onde estão vindo os leads"
            subtitle="Desfechos e origem geográfica dentro do filtro atual"
            delay={110}
          >
            <LeadsOrigem
              porUf={porUf}
              porCidade={porCidade}
              desfechos={desfechos}
              totalFiltrado={leads.length}
            />
          </Panel>
        </div>

        <div className="mt-4">
          <Panel
            title="Resultados"
            subtitle={`${formatNumber(leads.length)} de ${formatNumber(total)} leads na base`}
            action={<Pill>{formatNumber(leads.length)} leads</Pill>}
            delay={140}
          >
            <LeadsDirectory leads={leads} etapas={etapas} />
          </Panel>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-ink-faint sm:flex-row">
          <span>{empresaNome()} · Painel de leads — dados ao vivo do Supabase</span>
          <span className="tnum">Última leitura: {formatDateTime(generatedAt)}</span>
        </footer>
      </main>
    </div>
  );
}
