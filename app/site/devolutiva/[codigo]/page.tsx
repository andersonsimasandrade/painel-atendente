import type { Metadata } from "next";
import { cookies } from "next/headers";
import { whatsappNumero } from "@/lib/site";
import { assinaturaProfissional, dadosDeAcesso, devolutivaPublica } from "@/lib/devolutivas";
import { cookieDevolutiva, tokenValido } from "@/lib/devolutiva-acesso";
import { AcessoDevolutiva } from "@/components/site/AcessoDevolutiva";
import { IlustracaoDevolutiva } from "@/components/site/IlustracaoDevolutiva";
import { DocumentoDevolutiva } from "@/components/site/DocumentoDevolutiva";

export const dynamic = "force-dynamic";

// Documento PRIVADO do paciente (link com código secreto): fora do Google e das ferramentas de medição.
export const metadata: Metadata = {
  title: "Devolutiva do seu caso",
  robots: { index: false, follow: false, nocache: true },
};

function Inativo({ wa }: { wa: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
      <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746]">Este link não está mais ativo</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[#3F5452]">O documento foi encerrado ou o endereço está incompleto. Fale com o Anderson pelo WhatsApp para receber o link atualizado.</p>
      <a href={wa} className="mt-6 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white">
        Falar pelo WhatsApp
      </a>
    </section>
  );
}

export default async function Devolutiva({ params }: { params: { codigo: string } }) {
  const wa = `https://wa.me/${whatsappNumero()}`;

  // Documento de saúde: o código do link não basta. O paciente confirma a data de nascimento (cookie assinado, 12 h).
  const liberado = tokenValido(params.codigo, cookies().get(cookieDevolutiva(params.codigo))?.value);
  if (!liberado) {
    const info = await dadosDeAcesso(params.codigo);
    if (!info) return <Inativo wa={wa} />;
    return (
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <IlustracaoDevolutiva className="h-24 w-auto" />
        <h1 className="font-destaque mt-4 text-[28px] font-bold leading-tight text-[#354746]">Devolutiva do seu caso</h1>
        {info.nascimento ? (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-[#3F5452]">Este documento traz informações de saúde e é só seu. Para abrir, confirme a sua data de nascimento.</p>
            <AcessoDevolutiva codigo={params.codigo} />
          </>
        ) : (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-[#3F5452]">Este documento ainda não foi liberado para abertura. Fale com o Anderson pelo WhatsApp.</p>
            <a href={wa} className="mt-6 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white">
              Falar pelo WhatsApp
            </a>
          </>
        )}
        <p className="mt-8 text-[12.5px] leading-relaxed text-[#5E7371]">Protegemos o seu documento conforme a Lei Geral de Proteção de Dados (LGPD).</p>
      </section>
    );
  }

  const d = await devolutivaPublica(params.codigo);
  if (!d) return <Inativo wa={wa} />;
  const assinatura = await assinaturaProfissional();
  return <DocumentoDevolutiva d={d} assinatura={assinatura} wa={wa} />;
}
