import Link from "next/link";
import { ASSISTENTE_ATIVO, CONSULTORIOS, CREFITO, HORARIO_TEXTO, PROFISSIONAL } from "@/lib/site";

export const dynamic = "force-static";

function Cta({ children = "Agendar pelo WhatsApp", sub }: { children?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <Link
        href="/agendar"
        className="inline-flex items-center justify-center rounded-2xl bg-[#2f9e5e] px-7 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#278a50]"
      >
        {children}
      </Link>
      {sub ? <span className="text-[13px] text-[#6b7a71]">{sub}</span> : null}
    </div>
  );
}

const PASSOS = [
  {
    n: "1",
    t: "Você escolhe o consultório e os dias",
    d: "Leva menos de um minuto. Não pedimos nenhum dado de saúde aqui no site.",
  },
  {
    n: "2",
    t: "A conversa abre no WhatsApp",
    d: ASSISTENTE_ATIVO
      ? "Nosso assistente virtual tira dúvidas, entende o que você sente e organiza as informações para a equipe."
      : "Você fala direto com o Anderson, que já recebe o consultório, os dias e o período que você escolheu.",
  },
  {
    n: "3",
    t: "O Anderson confirma o horário",
    d: "Ele confere a agenda e a sala e confirma com você o dia e a hora da sua avaliação.",
  },
];

const PUBLICOS = [
  "Adultos",
  "Idosos",
  "Gestantes",
  "Crianças (com a presença de um responsável durante toda a sessão)",
];

const TECNICAS = [
  {
    nome: "Osteopatia",
    img: "/img/osteopatia.png",
    alt: "Ilustração de osteopatia: fisioterapeuta com as mãos nas costas de uma pessoa deitada",
    texto:
      "Técnica manual que olha o corpo como um todo e trabalha articulações, músculos e tecidos para favorecer a mobilidade e o equilíbrio do movimento. É considerada em dores musculoesqueléticas e restrições de movimento, após avaliação.",
  },
  {
    nome: "Quiropraxia",
    img: "/img/quiropraxia.png",
    alt: "Ilustração de quiropraxia: mãos do fisioterapeuta sobre a coluna",
    texto:
      "Técnica manual com foco no alinhamento e na mobilidade das articulações, especialmente da coluna. É aplicada de forma individualizada, depois de avaliar cada caso.",
  },
  {
    nome: "Terapia craniossacral",
    img: "/img/craniossacral.png",
    alt: "Ilustração de terapia craniossacral: toque suave na cabeça de uma pessoa deitada",
    texto:
      "Abordagem manual suave, feita na cabeça, na coluna e no sacro. Usada como complemento no cuidado de tensões musculares e do relaxamento, conforme a avaliação.",
  },
  {
    nome: "Método Maitland",
    img: "/img/maitland.png",
    alt: "Ilustração do método Maitland: mobilização manual da região lombar",
    texto:
      "Conceito de avaliação e mobilização articular manual, com técnicas graduadas de acordo com a resposta de cada pessoa. Aplicado em dores e limitações de movimento da coluna e das articulações.",
  },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2f9e5e]">
          Fisioterapia em Florianópolis
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-[34px] font-semibold leading-[1.08] tracking-tight text-[#16351f] sm:text-[52px]">
          Atendimento individual, com avaliação e tratamento na mesma sessão.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#4b5b51] sm:text-[19px]">
          Terapia manual, osteopatia, quiropraxia e mobilização articular, conforme o que a sua avaliação
          indicar. Dois consultórios, em Capoeiras e no Centro, com hora marcada.
        </p>
        <div className="mt-8">
          <Cta sub="Sem formulário de saúde. A conversa acontece no WhatsApp." />
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#4b5b51]">
          <li>Sessões de 60 minutos</li>
          <li>Atendimento particular</li>
          <li>Recibo de cada sessão</li>
          <li>{HORARIO_TEXTO}</li>
        </ul>
        </div>
        <figure className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/coluna.webp"
            alt="Ilustração de atendimento de fisioterapia: fisioterapeuta com as mãos sobre a coluna de uma pessoa sentada na maca"
            width={1536}
            height={1024}
            fetchPriority="high"
            className="h-auto w-full rounded-3xl object-cover shadow-[0_20px_50px_-24px_rgba(22,53,31,0.45)]"
          />
          <figcaption className="mt-2 text-[12px] text-[#6b7a71]">Imagem ilustrativa.</figcaption>
        </figure>
      </section>

      {/* TÉCNICAS */}
      <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#16351f] sm:text-[32px]">
          Técnicas manuais
        </h2>
        <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#4b5b51]">
          Combinadas de forma individual, conforme a avaliação de cada pessoa. Nenhuma técnica é indicada sem
          avaliação, e não há garantia de resultado.
        </p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {TECNICAS.map((t) => (
            <article key={t.nome} className="overflow-hidden rounded-2xl border border-[#e8e2d8] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.img} alt={t.alt} width={303} height={300} loading="lazy" className="h-52 w-full object-cover" />
              <div className="p-5">
                <h3 className="font-display text-[19px] font-semibold text-[#16351f]">{t.nome}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4b5b51]">{t.texto}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#6b7a71]">Imagens ilustrativas.</p>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-y border-[#e8e2d8] bg-white/60">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#16351f] sm:text-[32px]">
            Como funciona para agendar
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <li key={p.n} className="rounded-2xl border border-[#e8e2d8] bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f4ec] font-display text-[16px] font-semibold text-[#14603d]">
                  {p.n}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#16351f]">{p.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4b5b51]">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* A SESSÃO */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#16351f] sm:text-[32px]">
              Como é a sessão
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4b5b51]">
              Cada sessão dura 60 minutos e é individual: você é atendido do começo ao fim pelo próprio
              fisioterapeuta. Na primeira vez, a avaliação e o tratamento acontecem no mesmo encontro, a partir
              do que o exame mostrar. O tratamento indicado depende de cada pessoa e não há promessa de
              resultado.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4b5b51]">
              Traga exames, se tiver, e use roupa confortável e folgada. Não é preciso pedido médico para
              começar.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e8e2d8] bg-white p-6">
            <h3 className="text-[17px] font-semibold text-[#16351f]">Quem atendemos</h3>
            <ul className="mt-3 space-y-2 text-[15px] text-[#4b5b51]">
              {PUBLICOS.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#2f9e5e]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[14px] leading-relaxed text-[#6b7a71]">
              Atendemos queixas musculoesqueléticas, como dores na coluna, nos ombros, nos joelhos e nas
              articulações, depois de uma avaliação. Pagamento por Pix ou em dinheiro; não trabalhamos com
              convênios.
            </p>
          </div>
        </div>
      </section>

      {/* CONSULTÓRIOS */}
      <section className="border-y border-[#e8e2d8] bg-white/60">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#16351f] sm:text-[32px]">
            Dois consultórios em Florianópolis
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[CONSULTORIOS.capoeiras, CONSULTORIOS.centro].map((c) => (
              <article key={c.id} className="rounded-2xl border border-[#e8e2d8] bg-white p-6">
                <h3 className="font-display text-[20px] font-semibold text-[#16351f]">{c.nome}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4b5b51]">{c.linhaEndereco}</p>
                {c.cep ? <p className="text-[14px] text-[#6b7a71]">CEP {c.cep}</p> : null}
                <div className="mt-4 flex flex-wrap gap-4 text-[14.5px] font-semibold">
                  <a href={c.mapaUrl} target="_blank" rel="noopener noreferrer" className="text-[#2f9e5e] hover:underline">
                    Abrir no mapa
                  </a>
                  <Link href={`/${c.id}`} className="text-[#2f9e5e] hover:underline">
                    Como chegar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* QUEM ATENDE */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#16351f] sm:text-[32px]">
          Quem atende
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#4b5b51]">
          <strong className="text-[#16351f]">{PROFISSIONAL}</strong>, fisioterapeuta, atendendo em
          Florianópolis. Registro profissional: {CREFITO}.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <div className="rounded-3xl bg-[#16351f] px-6 py-10 text-white sm:px-10">
          <h2 className="font-display text-[26px] font-semibold tracking-tight sm:text-[32px]">
            Pronto para agendar a sua avaliação?
          </h2>
          <p className="mt-3 max-w-xl text-[16px] text-white/80">
            Escolha o consultório e os dias que ficam melhores. O Anderson confirma o horário com você pelo
            WhatsApp.
          </p>
          <Link
            href="/agendar"
            className="mt-6 inline-flex rounded-2xl bg-white px-7 py-4 text-[16px] font-semibold text-[#14603d] transition hover:bg-[#e7f4ec]"
          >
            Agendar pelo WhatsApp
          </Link>
        </div>
      </section>
    </>
  );
}
