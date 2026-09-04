import { SubNav } from "@/components/SubNav";
import { ConexaoWhatsApp } from "@/components/ConexaoWhatsApp";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { getSessao } from "@/lib/session";
import { instanciasPermitidas } from "@/lib/escopo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConexaoPage() {
  const sess = await getSessao();
  // Admin vê os números de todos os consultores; consultor vê só o dele.
  const instancias = await instanciasPermitidas(sess);
  const varias = instancias.length > 1;

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title="Conexão"
        subtitle={
          varias
            ? `${instancias.length} números · estado e re-pareamento`
            : "Estado do WhatsApp e re-pareamento"
        }
      />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {!instancias.length ? (
          <Panel>
            <EmptyState
              title="Nenhum número atribuído a você"
              hint="Fale com o administrador para vincular um WhatsApp ao seu cadastro."
            />
          </Panel>
        ) : (
          <div className="flex flex-col gap-6">
            {instancias.map((v) => (
              <section key={v.instancia}>
                {varias && (
                  <h2 className="mb-2.5 px-1 font-display text-[15px] font-semibold tracking-tight text-ink">
                    {v.nome}{" "}
                    <span className="font-sans text-[12px] font-normal text-ink-faint">
                      · instância {v.instancia}
                    </span>
                  </h2>
                )}
                <ConexaoWhatsApp instancia={v.instancia} nome={v.nome} />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
