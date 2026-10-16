import type { Metadata } from "next";
import Link from "next/link";
import { MARCA, PROFISSIONAL, CREFITO, WHATSAPP_PADRAO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Exclusão de dados",
  description: "Como pedir a exclusão dos seus dados (WhatsApp, Instagram e site).",
  alternates: { canonical: "/exclusao-de-dados" },
};

export default function ExclusaoDeDados() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        Exclusão de dados
      </h1>
      <div className="mt-8 space-y-6 text-[15.5px] leading-relaxed text-[#3F5452]">
        <p>
          {MARCA}, de {PROFISSIONAL} ({CREFITO}), guarda apenas o necessário para o atendimento: as mensagens trocadas
          pelo WhatsApp ou pelo Instagram (direct e comentários) e as preferências de horário.
        </p>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Como pedir a exclusão</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Mande uma mensagem pelo{" "}
              <a
                className="font-bold text-[#0F7F70] underline-offset-2 hover:underline"
                href={`https://wa.me/${WHATSAPP_PADRAO}?text=${encodeURIComponent("Olá! Quero pedir a exclusão dos meus dados.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp da clínica
              </a>{" "}
              ou pelo direct do Instagram <strong>@andersonandrade_fisio</strong> com o texto “quero a exclusão dos meus
              dados”.
            </li>
            <li>Confirmaremos que é você e apagaremos as conversas e os dados de contato em até 15 dias.</li>
            <li>Você recebe um aviso quando a exclusão estiver concluída.</li>
          </ol>
        </div>
        <p>
          Dados de prontuário e recibos podem ter prazo mínimo de guarda definido pela lei e pelo conselho profissional. Nesse
          caso explicamos o que precisa ser mantido e por quê.
        </p>
        <p>
          Para saber mais, leia a{" "}
          <Link href="/privacidade" className="font-bold text-[#0F7F70] underline-offset-2 hover:underline">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
