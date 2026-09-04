import { getConversas } from "@/lib/db";
import { getEtapas } from "@/lib/funil";
import { formatNumber } from "@/lib/format";
import { SubNav } from "@/components/SubNav";
import { LiveStatus } from "@/components/LiveStatus";
import { DbErrorState } from "@/components/DbErrorState";
import { InboxClient } from "@/components/inbox/InboxClient";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";
import { listarVendedores } from "@/lib/agenda";
import { FiltroConsultor } from "@/components/FiltroConsultor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: { tel?: string; consultor?: string };
}) {
  const sess = await getSessao();
  const [result, consultores, etapas] = await Promise.all([
    getConversas(escopoDaLista(sess, searchParams?.consultor)),
    sess?.papel === "admin" ? listarVendedores() : Promise.resolve([]),
    getEtapas(),
  ]);

  if (!result.ok) {
    return <DbErrorState error={result.error} />;
  }

  const { conversas, generatedAt } = result;

  // App shell: a PÁGINA não rola — quem rola são os painéis por dentro. A altura
  // é EXATA (h-, não min-h-) de propósito: com min-height a lista de conversas,
  // que é alta, empurrava o container pra além da tela, o grid crescia junto e o
  // chat virava uma caixa gigante que rolava a conversa inteira na página.
  // 100dvh e não 100vh porque no Safari/Chrome mobile o vh é o viewport GRANDE
  // (barra de URL recolhida), e o compositor nascia abaixo da dobra.
  return (
    <div className="relative z-[1] flex h-[100dvh] flex-col overflow-hidden">
      <SubNav
        title="Conversas"
        subtitle={`${formatNumber(conversas.length)} conversas ativas no WhatsApp`}
        right={
          <>
            <FiltroConsultor consultores={consultores} atual={searchParams?.consultor} />
            <LiveStatus generatedAt={generatedAt} />
          </>
        }
      />

      <main className="mx-auto flex w-full min-h-0 max-w-[1400px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <InboxClient
          initial={conversas}
          initialTel={searchParams?.tel}
          consultor={searchParams?.consultor}
          etapas={etapas.map((e) => ({ key: e.key, label: e.label, color: e.color }))}
          admin={sess?.papel === "admin"}
        />
      </main>
    </div>
  );
}
