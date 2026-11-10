import { redirect } from "next/navigation";
import { SubNav } from "@/components/SubNav";
import { PacientesBoard } from "@/components/tratamento/PacientesBoard";
import { listarPacientesTratamento } from "@/lib/pacientes-tratamento";
import { getSessao } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TratamentoPage() {
  const sess = await getSessao();
  if (sess?.papel === "vendedor") redirect("/leads");
  const pacientes = await listarPacientesTratamento().catch(() => []);
  const ativos = pacientes.filter((p) => !p.encerrado).length;
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Em tratamento" subtitle={`${ativos} paciente(s) em acompanhamento · pacote, sessões, dor e exercícios`} />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <PacientesBoard pacientes={pacientes} />
      </main>
    </div>
  );
}
