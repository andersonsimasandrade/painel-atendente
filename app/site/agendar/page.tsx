import type { Metadata } from "next";
import { FormAgendar } from "@/components/site/FormAgendar";
import { HORARIO_TEXTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agendar avaliação de fisioterapia",
  description:
    "Escolha o consultório (Capoeiras ou Centro), os dias e o período. Continue no WhatsApp e o Anderson confirma o horário com você.",
  alternates: { canonical: "/agendar" },
};

export default function AgendarPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight text-[#16351f] sm:text-[40px]">
        Agende a sua avaliação
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-[#4b5b51]">
        Diga o consultório e os dias que ficam melhores. A conversa continua no WhatsApp e o Anderson confirma
        o horário com você. {HORARIO_TEXTO}.
      </p>
      <div className="mt-9">
        <FormAgendar />
      </div>
    </section>
  );
}
