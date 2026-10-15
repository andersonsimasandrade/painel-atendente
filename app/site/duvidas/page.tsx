import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dúvidas frequentes sobre as sessões",
  description:
    "Como funciona a sessão, o que levar, formas de pagamento, recibo, crianças, gestantes e remarcação.",
  alternates: { canonical: "/duvidas" },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como funciona a primeira sessão?",
    a: "Dura 60 minutos e é individual. Em cada sessão o fisioterapeuta avalia o seu quadro e aplica as técnicas indicadas, a partir do que o exame indicar. O tratamento depende de cada pessoa e não há promessa de resultado.",
  },
  {
    q: "Preciso de pedido médico?",
    a: "Não. Se você tiver exames ou laudos, traga para a avaliação.",
  },
  {
    q: "O que devo levar e vestir?",
    a: "Exames, se tiver, e roupa confortável e folgada. Mulheres podem ir com top e bermuda ou short de lycra, para facilitar a avaliação.",
  },
  {
    q: "Quais técnicas são usadas?",
    a: "Terapia manual com osteopatia, quiropraxia, conceito Maitland, conceito Mulligan, Kabat/FNP e terapia craniossacral, conforme o que a avaliação indicar.",
  },
  {
    q: "Quem pode ser atendido?",
    a: "Adultos, idosos e gestantes. Crianças também, desde que um responsável esteja presente durante toda a sessão.",
  },
  {
    q: "Qual o valor da consulta? Quais as formas de pagamento?",
    a: "A consulta particular custa R$ 250,00. O atendimento é particular, sem convênio, e o pagamento é por Pix ou em dinheiro.",
  },
  {
    q: "Vocês fazem atendimento domiciliar?",
    a: "Sim, mediante consulta. O atendimento domiciliar custa R$ 350,00, mais o deslocamento, que varia conforme a distância. Combine pelo WhatsApp.",
  },
  {
    q: "Vocês dão recibo?",
    a: "Sim. O Anderson emite recibo de cada sessão, que pode ser usado para pedir reembolso ao seu plano de saúde ou na declaração do imposto de renda. Cada plano tem as suas regras, então confirme com o seu.",
  },
  {
    q: "E se eu precisar remarcar?",
    a: "Avise com pelo menos 48 horas de antecedência pelo próprio WhatsApp.",
  },
  {
    q: "Em quais dias e horários atendem?",
    a: "De segunda a sexta, das 8h às 19h, em Capoeiras e no Centro. Os horários são combinados pelo WhatsApp.",
  },
];

export default function Duvidas() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        Dúvidas frequentes
      </h1>
      <div className="mt-8 space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-[#DCE8E5] bg-white p-5 open:shadow-sm">
            <summary className="cursor-pointer list-none text-[16.5px] font-semibold text-[#354746] marker:hidden">
              {f.q}
            </summary>
            <p className="mt-3 text-[15.5px] leading-relaxed text-[#4A5F5D]">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-10">
        <Link
          href="/agendar"
          className="inline-flex items-center justify-center rounded-2xl bg-[#0F7F70] px-7 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#0B6B5E]"
        >
          Agendar pelo WhatsApp
        </Link>
      </div>
    </section>
  );
}
