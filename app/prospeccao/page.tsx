import { redirect } from "next/navigation";
import { SubNav } from "@/components/SubNav";
import { ProspeccaoBoard } from "@/components/ProspeccaoBoard";
import { ehAdmin } from "@/lib/session";
import { campanhaAtiva, dentroDaJanelaProspeccao, INTERVALO_MIN, LIMITE_DIA, listarProspectos, textoDoPasso } from "@/lib/prospeccao";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProspeccaoPage() {
  if (!(await ehAdmin())) redirect("/prioridades");
  const [lista, ativa] = await Promise.all([listarProspectos(), campanhaAtiva()]);
  const itens = lista.map((p) => ({ ...p, proxima_mensagem: p.passo < 4 && ["fila", "aguardando"].includes(p.status) ? textoDoPasso(p, p.passo + 1) : null }));
  const respondeu = lista.filter((p) => p.status === "respondeu").length;
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Parcerias" subtitle={`${lista.length} estabelecimentos · ${respondeu} resposta(s) para você`} />
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        <ProspeccaoBoard itens={itens} ativa={ativa} dentroDaJanela={dentroDaJanelaProspeccao()} intervaloMin={INTERVALO_MIN} limiteDia={LIMITE_DIA} />
      </main>
    </div>
  );
}
