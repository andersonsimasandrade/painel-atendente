import { getLeads } from "@/lib/db";
import { getEtapas } from "@/lib/funil";
import { formatNumber } from "@/lib/format";
import { SubNav } from "@/components/SubNav";
import { LiveStatus } from "@/components/LiveStatus";
import { DbErrorState } from "@/components/DbErrorState";
import { FiltroConsultor } from "@/components/FiltroConsultor";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";
import { listarVendedores } from "@/lib/agenda";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FunilPage({
  searchParams,
}: {
  searchParams: { consultor?: string | string[] };
}) {
  const sess = await getSessao();
  // Consultores primeiro (fail-closed: só admin recebe a lista) pra validar o
  // ?consultor= da URL — slug lixo vira "Todos" em vez de zerar o board.
  const consultores = sess?.papel === "admin" ? await listarVendedores() : [];
  const consultorUrl = sp(searchParams.consultor);
  const consultorOk =
    consultorUrl && consultores.some((c) => c.slug === consultorUrl)
      ? consultorUrl
      : undefined;
  const dono = escopoDaLista(sess, consultorOk);

  const [result, etapas] = await Promise.all([getLeads({ dono }), getEtapas()]);

  if (!result.ok) return <DbErrorState error={result.error} />;

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title="Funil"
        subtitle={`Kanban de ${formatNumber(result.leads.length)} leads por estágio`}
        right={
          <>
            <FiltroConsultor consultores={consultores} atual={consultorOk} />
            <LiveStatus generatedAt={result.generatedAt} />
          </>
        }
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <KanbanBoard leads={result.leads} etapas={etapas} />

        <footer className="mt-4 flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-ink-faint sm:flex-row">
          <span>
            {empresaNome()} · Funil kanban — mover um card registra o ajuste na
            linha do tempo do lead (como mudança manual)
          </span>
        </footer>
      </main>
    </div>
  );
}
