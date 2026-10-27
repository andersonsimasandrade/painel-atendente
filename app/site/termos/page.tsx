import type { Metadata } from "next";
import Link from "next/link";
import { MARCA, PROFISSIONAL, CREFITO, WHATSAPP_PADRAO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do site e do atendimento por WhatsApp e Instagram.",
  alternates: { canonical: "/termos" },
};

export default function Termos() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        Termos de uso
      </h1>
      <div className="mt-8 space-y-6 text-[15.5px] leading-relaxed text-[#3F5452]">
        <p>
          Este site e os canais de contato (WhatsApp e Instagram) pertencem a {MARCA}, de {PROFISSIONAL} ({CREFITO}).
          Ao usá-los, você concorda com as regras abaixo.
        </p>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Para que servem</h2>
          <p className="mt-2">
            O site e as mensagens servem para apresentar o atendimento, tirar dúvidas gerais e combinar horário de
            avaliação. As respostas automáticas ajudam a organizar o atendimento, mas não são avaliação, diagnóstico nem
            orientação de tratamento. Quem avalia e orienta é o fisioterapeuta, em consulta.
          </p>
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Conteúdo do site e do blog</h2>
          <p className="mt-2">
            Os textos têm caráter informativo e não substituem uma consulta. Cada pessoa é diferente: procure atendimento
            profissional para avaliar o seu caso. Em situação de urgência, procure um serviço de emergência.
          </p>
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Agendamento e remarcação</h2>
          <p className="mt-2">
            O horário só está reservado depois da confirmação feita pela clínica. Para remarcar ou cancelar, avise com 48
            horas de antecedência pelo WhatsApp.
          </p>
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Suas mensagens e seus dados</h2>
          <p className="mt-2">
            Mensagens e dados de contato são usados só para o atendimento, como descrito na{" "}
            <Link href="/privacidade" className="font-bold text-[#0F7F70] underline-offset-2 hover:underline">
              política de privacidade
            </Link>
            . Você pode pedir a exclusão a qualquer momento em{" "}
            <Link href="/exclusao-de-dados" className="font-bold text-[#0F7F70] underline-offset-2 hover:underline">
              exclusão de dados
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Uso adequado</h2>
          <p className="mt-2">
            Pedimos respeito no contato com a equipe. Mensagens ofensivas, spam ou tentativa de uso indevido dos canais
            podem ser bloqueados.
          </p>
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Contato</h2>
          <p className="mt-2">
            Dúvidas sobre estes termos: mande uma mensagem pelo{" "}
            <a
              className="font-bold text-[#0F7F70] underline-offset-2 hover:underline"
              href={`https://wa.me/${WHATSAPP_PADRAO}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp da clínica
            </a>{" "}
            ou pelo direct do Instagram <strong>@andersonandrade_fisio</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}
