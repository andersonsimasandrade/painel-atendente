import { SubNav } from "@/components/SubNav";
import { TarefasBoard } from "@/components/tarefas/TarefasBoard";
import { listarTarefas } from "@/lib/tarefas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TarefasPage() {
  const tarefas = await listarTarefas();
  const abertas = tarefas.filter((t) => t.status === "sugerida" || t.status === "aprovada").length;
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Tarefas" subtitle={`${abertas} em aberto · acompanhamento de pacientes e negociações`} />
      <main className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
        <TarefasBoard inicial={tarefas} />
      </main>
    </div>
  );
}
