import type { Metadata } from "next";
import { whatsappNumero } from "@/lib/site";
import { conviteValido } from "@/lib/cadastro";
import { FormCadastro } from "@/components/site/FormCadastro";

export const dynamic = "force-dynamic";

// Página PRIVADA do paciente (link com código secreto): fora do Google e das ferramentas de medição.
export const metadata: Metadata = {
  title: "Cadastro do paciente",
  robots: { index: false, follow: false, nocache: true },
};

export default async function Cadastro({ params }: { params: { codigo: string } }) {
  const c = await conviteValido(params.codigo);
  if (!c) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746]">Este link já foi usado ou venceu</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[#3F5452]">Se você ainda não preencheu o cadastro, peça um novo link ao Anderson pelo WhatsApp.</p>
        <a href={`https://wa.me/${whatsappNumero()}`} className="mt-6 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white">
          Falar pelo WhatsApp
        </a>
      </section>
    );
  }
  if (!c.faltam.length) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746]">Seu cadastro já está completo</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[#3F5452]">Não precisa preencher mais nada. Obrigado!</p>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-2xl px-4 pb-14 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-destaque text-[28px] font-bold leading-tight tracking-tight text-[#354746] sm:text-[34px]">Seu cadastro</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-[#3F5452]">
        {c.faltam.length >= 4 ? "Leva uns 2 minutos." : "Falta pouco."} Com estes dados eu confirmo o seu agendamento e preparo os seus documentos. Eles ficam só comigo, protegidos pela LGPD.
      </p>
      <FormCadastro codigo={params.codigo} finalTelefone={c.finalTelefone} faltam={c.faltam} />
    </section>
  );
}
