import { listarAgendamentos, listarVendedores } from "@/lib/agenda";
import { escopoDaLista } from "@/lib/escopo";
import { FiltroConsultor } from "@/components/FiltroConsultor";
import { SubNav } from "@/components/SubNav";
import { AgendaBoard } from "@/components/AgendaBoard";
import { CriarConvite } from "@/components/CriarConvite";
import { getSessao } from "@/lib/session";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { consultor?: string };
}) {
  const sess = await getSessao();
  // escopoDaLista é fail-closed: vendedor sem slug recebe um valor que não casa
  // com ninguém (lista vazia), nunca "todos".
  const escopo = escopoDaLista(sess, searchParams?.consultor);
  const [items, consultores] = await Promise.all([
    listarAgendamentos(escopo),
    sess?.papel === "vendedor" ? Promise.resolve([]) : listarVendedores(),
  ]);
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title="Agenda"
        subtitle="Reuniões · presença e lembretes"
        right={<FiltroConsultor consultores={consultores} atual={searchParams?.consultor} />}
      />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-4">
          <CriarConvite />
        </div>
        <AgendaBoard items={items} />
        <footer className="mt-8 border-t border-line pt-5 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Agenda — lembrete automático ~3h antes de cada reunião
        </footer>
      </main>
    </div>
  );
}
