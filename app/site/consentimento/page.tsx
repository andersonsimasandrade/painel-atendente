import type { Metadata } from "next";
import { CREFITO, MARCA, PROFISSIONAL } from "@/lib/site";
import { BotaoImprimir } from "@/components/site/BotaoImprimir";

// Termo para o paciente ler e assinar na primeira sessão (pode ser impresso ou salvo em PDF).
export const metadata: Metadata = {
  title: "Termo de consentimento do paciente",
  robots: { index: false, follow: true },
};

const ITENS: { titulo: string; texto: string; opcional?: boolean }[] = [
  {
    titulo: "Registro e tratamento dos meus dados de saúde",
    texto:
      "Autorizo o registro do meu prontuário (queixa, exames, avaliação, técnicas, evolução e orientações) e o tratamento desses dados de saúde para o meu atendimento, conforme a política de privacidade.",
  },
  {
    titulo: "Gravação do áudio da sessão",
    texto:
      "Autorizo a gravação do áudio da sessão, usada apenas para ajudar o fisioterapeuta a redigir o meu prontuário. O áudio é transformado em texto e descartado. Posso recusar sem prejuízo ao atendimento.",
    opcional: true,
  },
  {
    titulo: "Uso de inteligência artificial como apoio",
    texto:
      "Estou ciente de que serviços de inteligência artificial (como Groq e OpenAI), que podem operar fora do Brasil, ajudam a transcrever, resumir laudos e redigir rascunhos que o fisioterapeuta revisa. Nenhuma decisão de tratamento é tomada pela IA.",
    opcional: true,
  },
  {
    titulo: "Plano de exercícios e devolutiva por link",
    texto:
      "Autorizo o envio, pelo meu WhatsApp, de links privados com o meu plano de exercícios e com a devolutiva do meu caso, e a resposta que eu der pelo link.",
  },
  {
    titulo: "Imagens dos meus exames para acompanhamento",
    texto:
      "Autorizo guardar as imagens e laudos dos meus exames no prontuário para comparar a minha evolução. Não serão usados em divulgação ou publicidade.",
    opcional: true,
  },
];

export default function Consentimento() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
      <style>{`@media print{header,footer,[data-no-print]{display:none!important}body{background:#fff!important}}`}</style>
      <h1 className="font-destaque text-[28px] font-bold leading-tight tracking-tight text-[#354746] sm:text-[36px]">
        Termo de consentimento do paciente
      </h1>
      <p className="mt-2 text-[14px] text-[#5E7371]">
        {MARCA} · {PROFISSIONAL} · {CREFITO}
      </p>
      <p className="mt-6 text-[15.5px] leading-relaxed text-[#3F5452]">
        Leia com calma e marque o que você autoriza. Os itens opcionais podem ser recusados sem nenhum prejuízo ao seu atendimento, e você pode retirar
        qualquer autorização quando quiser, avisando o fisioterapeuta. Mais detalhes na{" "}
        <a href="/privacidade" className="font-bold text-[#0F7F70] underline-offset-2 hover:underline">
          política de privacidade
        </a>
        .
      </p>

      <ul className="mt-6 space-y-4">
        {ITENS.map((i) => (
          <li key={i.titulo} className="flex gap-3 rounded-2xl border border-[#D8E4E1] bg-white p-4">
            <span className="mt-1 inline-block h-5 w-5 shrink-0 rounded border-2 border-[#354746]" aria-hidden="true" />
            <div>
              <p className="text-[16px] font-semibold text-[#354746]">
                {i.titulo} {i.opcional && <span className="text-[13px] font-normal text-[#5E7371]">(opcional)</span>}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-[#3F5452]">{i.texto}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <div className="h-10 border-b border-[#354746]" />
          <p className="mt-1 text-[13px] text-[#5E7371]">Nome e assinatura do paciente (ou responsável)</p>
        </div>
        <div>
          <div className="h-10 border-b border-[#354746]" />
          <p className="mt-1 text-[13px] text-[#5E7371]">Local e data</p>
        </div>
      </div>

      <div className="mt-8" data-no-print>
        <BotaoImprimir />
      </div>
    </section>
  );
}
