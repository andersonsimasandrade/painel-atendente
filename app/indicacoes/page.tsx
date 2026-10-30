import { redirect } from "next/navigation";
import { SubNav } from "@/components/SubNav";
import { IndicacoesBoard } from "@/components/IndicacoesBoard";
import { ehAdmin } from "@/lib/session";
import { SITE_URL } from "@/lib/site";
import { HORAS_ATE_ESFRIAR, LIMITE_ENVIOS_DIA, latenciaHoras, listarIndicacoes, mensagemPadrao, relatorioParceiros } from "@/lib/indicacoes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IndicacoesPage() {
  if (!(await ehAdmin())) redirect("/prioridades");
  const [indicacoes, relatorio] = await Promise.all([listarIndicacoes(), relatorioParceiros()]);
  const prontas = indicacoes.filter((i) => i.status === "pronta").length;
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="Indicações" subtitle={`${prontas} pronta(s) para contatar · parceiros e resultados`} />
      <main className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
        <IndicacoesBoard
          siteUrl={SITE_URL}
          latenciaHoras={latenciaHoras()}
          limiteDia={LIMITE_ENVIOS_DIA}
          horasEsfriar={HORAS_ATE_ESFRIAR}
          indicacoes={indicacoes.map((i) => ({
            ...i,
            mensagem: mensagemPadrao(i.paciente_nome, i.parceiro_nome),
          }))}
          relatorio={relatorio}
        />
      </main>
    </div>
  );
}
