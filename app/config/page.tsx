import { SubNav } from "@/components/SubNav";
import { Ajustes } from "@/components/Ajustes";
import { Panel } from "@/components/Panel";
import { FunilEtapas } from "@/components/FunilEtapas";
import { ModoDemo } from "@/components/ModoDemo";
import { getEtapasComMsgs } from "@/lib/funil";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConfigPage() {
  const { etapas, msgs } = await getEtapasComMsgs();

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Ajustes" subtitle="Atendente, respostas rápidas e funil" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Ajustes />

        <div className="mt-4">
          <ModoDemo />
        </div>

        <div className="mt-4">
          <Panel
            title="Etapas do funil"
            subtitle="Colunas do kanban + sequência automática de mensagens ao mover um lead"
          >
            <FunilEtapas
              initialEtapas={etapas}
              initialMsgs={Object.fromEntries(
                Object.entries(msgs).map(([k, v]) => [
                  k,
                  v.map((m) => ({ atraso_min: m.atraso_min, texto: m.texto })),
                ]),
              )}
            />
          </Panel>
        </div>
      </main>
    </div>
  );
}
