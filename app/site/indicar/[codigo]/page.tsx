import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormIndicar } from "@/components/site/FormIndicar";
import { parceiroPorCodigo } from "@/lib/indicacoes";
import { PROFISSIONAL, CREFITO } from "@/lib/site";

export const dynamic = "force-dynamic";

// Página de parceiros: fora do Google (noindex) e sem aparecer no menu do site.
export const metadata: Metadata = {
  title: "Indicar um paciente",
  robots: { index: false, follow: false },
};

export default async function Indicar({ params }: { params: { codigo: string } }) {
  const parceiro = await parceiroPorCodigo(decodeURIComponent(params.codigo).slice(0, 60));
  if (!parceiro || !parceiro.ativo) notFound();
  return (
    <section className="mx-auto max-w-xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0F7F70]">Parceria · {parceiro.nome}</p>
      <h1 className="mt-2 font-destaque text-[28px] font-bold leading-tight tracking-tight text-[#354746] sm:text-[36px]">
        Indicar uma pessoa para o {PROFISSIONAL.split(" ")[0]}
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-[#3F5452]">
        Conhece alguém que gostaria de saber como funciona a fisioterapia com terapia manual? Deixe o nome e o WhatsApp da pessoa.
        O {PROFISSIONAL.split(" ")[0]} escreve se apresentando, avisa que foi você quem indicou e tira as dúvidas, sem compromisso.
      </p>
      <FormIndicar codigo={parceiro.codigo} />
      <p className="mt-6 text-[12.5px] leading-relaxed text-[#5E7371]">
        {PROFISSIONAL} · {CREFITO}. Usamos o nome e o telefone só para esse contato. Se a pessoa não quiser receber mensagens, basta
        avisar e não escrevemos mais.
      </p>
    </section>
  );
}
