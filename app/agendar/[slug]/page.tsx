import { notFound } from "next/navigation";
import { getVendedorBySlug, getOcupados } from "@/lib/agenda";
import { gerarSlotsDias } from "@/lib/slots";
import { AgendarCliente } from "@/components/AgendarCliente";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lead?: string; convite?: string };
}) {
  const vend = await getVendedorBySlug(params.slug);
  if (!vend) notFound();

  const telefone = (searchParams?.lead ?? "").replace(/\D/g, "");
  const conviteToken = searchParams?.convite ?? "";
  // Segurança/privacidade: em rota PÚBLICA não consultamos o nome do lead no
  // banco (evita enumeração de leads + vazamento de PII). A pessoa digita o
  // nome ao agendar.
  const ocupados = await getOcupados(vend.id);
  const dias = gerarSlotsDias(vend.disponibilidade, ocupados);

  return (
    <main className="min-h-screen w-full bg-[#faf8f5] px-4 py-10 sm:px-6">
      {/* faixa superior colorida (>>> ADAPTE às suas cores <<<) */}
      <div className="fixed inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#2f9e5e] via-[#3bb26c] to-[#e07e2b]" />
      <div className="mx-auto max-w-[920px]">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt={empresaNome()} className="h-11 w-auto sm:h-12" />
          <h1 className="mt-5 text-[25px] font-semibold tracking-tight text-[#16351f] sm:text-[28px]">
            Agende com {vend.nome}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[#7a746c]">
            {empresaNome()} · escolha o melhor horário (horário de Brasília)
          </p>
        </div>
        <AgendarCliente
          empresa={empresaNome()}
          consultorNome={vend.nome}
          slug={vend.slug}
          dias={dias}
          nomeInicial={null}
          telefoneInicial={telefone}
          conviteToken={conviteToken}
        />
      </div>
    </main>
  );
}
