import Link from "next/link";
import { RedesSociais } from "@/components/site/RedesSociais";
import {
  ASSISTENTE_ATIVO,
  CONSULTORIOS,
  CREFITO,
  HORARIO_TEXTO,
  PROFISSIONAL,
  SLOGAN,
} from "@/lib/site";

export const dynamic = "force-static";

const BTN =
  "inline-flex items-center justify-center rounded-2xl bg-[#0F7F70] px-7 py-4 text-[16px] font-bold text-white shadow-md transition hover:bg-[#0B6B5E]";

const NECESSIDADES = [
  {
    t: "Dores na coluna",
    d: "Avaliação do movimento e do conjunto da coluna, com um plano individual para cada pessoa.",
  },
  {
    t: "Região cervical",
    d: "Pescoço e ombros: tensão, limitação de movimento e desconforto, conforme a avaliação.",
  },
  {
    t: "Região lombar",
    d: "Lombar e quadril: dores ao sentar, levantar ou se movimentar, conforme a avaliação.",
  },
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
    nome: "Conceito Maitland",
    img: "/img/maitland.png",
    alt: "Ilustração do conceito Maitland: mobilização manual da região lombar",
    texto:
      "Conceito de avaliação e mobilização articular manual, com técnicas graduadas de acordo com a resposta de cada pessoa. Aplicado em dores e limitações de movimento da coluna e das articulações.",
  },
  {
    nome: "Conceito Mulligan",
    img: "/img/mulligan.webp",
    alt: "Ilustração do conceito Mulligan: fisioterapeuta mobiliza o ombro enquanto a pessoa eleva o braço",
    texto:
      "Mobilização com movimento: o fisioterapeuta mobiliza a articulação enquanto a pessoa realiza um movimento ativo. Usado em limitações e dores de movimento, conforme a avaliação.",
  },
  {
    nome: "Kabat / FNP",
    img: "/img/kabat.webp",
    alt: "Ilustração de Kabat/FNP: fisioterapeuta aplica resistência manual ao movimento do braço",
    texto:
      "Facilitação neuromuscular proprioceptiva: padrões de movimento com resistência manual para trabalhar força, coordenação e mobilidade, conforme a avaliação.",
  },
];

const PUBLICOS = [
  "Adultos",
  "Idosos",
  "Gestantes",
  "Crianças (com a presença de um responsável durante toda a sessão)",
];

export default function Home() {
  const passos = [
    {
      n: "1",
      t: "Você escolhe o consultório e os dias",
      d: "Leva menos de um minuto. Não pedimos nenhum dado de saúde aqui no site.",
    },
    {
      n: "2",
      t: "A conversa abre no WhatsApp",
      d: ASSISTENTE_ATIVO
        ? "Nosso assistente virtual tira dúvidas, entende o que você sente e organiza as informações para o fisioterapeuta."
        : "Você fala direto com o Anderson, que já recebe o consultório, os dias e o período que você escolheu.",
    },
    {
      n: "3",
      t: "O Anderson confirma o horário",
      d: "Ele confere a agenda e a sala e confirma com você o dia e a hora da sua avaliação.",
    },
  ];

  return (
    <>
      {/* 1. APRESENTAÇÃO E CHAMADA PARA AGENDAMENTO */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="font-destaque text-[13px] font-bold uppercase tracking-[0.14em] text-[#0F7F70]">{SLOGAN}</p>
          <h1 className="mt-4 max-w-3xl text-[32px] font-semibold leading-[1.12] tracking-tight text-[#354746] sm:text-[46px]">
            Fisioterapia para dores na coluna, cervical e lombar em Florianópolis.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#4A5F5D] sm:text-[19px]">
            Atendimento individualizado com terapia manual e avaliação fisioterapêutica. A avaliação e o tratamento
            acontecem na mesma sessão, em Capoeiras e no Centro, com hora marcada.
          </p>
          <div className="mt-8 flex flex-col items-start gap-2">
            <Link href="/agendar" className={BTN}>
              Agende sua avaliação
            </Link>
            <span className="text-[13px] text-[#5E7371]">Sem formulário de saúde. A conversa acontece no WhatsApp.</span>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#4A5F5D]">
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
            className="h-auto w-full rounded-3xl object-cover shadow-[0_20px_50px_-24px_rgba(53,71,70,0.5)]"
          />
          <figcaption className="mt-2 text-[12px] text-[#5E7371]">Imagem ilustrativa.</figcaption>
        </figure>
      </section>

      {/* 2. PRINCIPAIS NECESSIDADES ATENDIDAS */}
      <section className="border-y border-[#DCE8E5] bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">
            Principais necessidades atendidas
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            {NECESSIDADES.map((n) => (
              <article key={n.t} className="rounded-2xl border border-[#DCE8E5] bg-white p-5">
                <span aria-hidden className="block h-1.5 w-10 rounded-full bg-[#1EB49F]" />
                <h3 className="mt-4 text-[18px] font-semibold text-[#354746]">{n.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A5F5D]">{n.d}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-[14.5px] leading-relaxed text-[#5E7371]">
            O foco da nossa comunicação é a coluna, mas o atendimento não se limita a ela: outras regiões e
            articulações também são avaliadas. O cuidado é definido na avaliação de cada pessoa.
          </p>
        </div>
      </section>

      {/* 3. SOBRE O PROFISSIONAL */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">Sobre o profissional</h2>
        <p className="mt-4 max-w-3xl text-[16.5px] leading-relaxed text-[#4A5F5D]">
          <strong className="text-[#354746]">{PROFISSIONAL}</strong> é fisioterapeuta, com atuação em fisioterapia desde
          2005, e atende em Florianópolis de forma individualizada. Integra recursos de fisioterapia e terapia manual, selecionados conforme a avaliação
          e as necessidades de cada paciente, com escuta, atenção e um plano pensado para a sua rotina. Registro
          profissional: {CREFITO}.
        </p>
      </section>

      {/* 4. ABORDAGENS E RECURSOS TERAPÊUTICOS */}
      <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">
          Abordagens e recursos terapêuticos
        </h2>
        <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#4A5F5D]">
          Combinados de forma individual, conforme a avaliação de cada pessoa. Nenhuma técnica é indicada sem
          avaliação, e não há garantia de resultado.
        </p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {TECNICAS.map((t) => (
            <article key={t.nome} className="overflow-hidden rounded-2xl border border-[#DCE8E5] bg-white">
              {t.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.img} alt={t.alt} width={303} height={300} loading="lazy" className="h-52 w-full object-cover" />
              ) : (
                <div className="flex h-52 w-full items-center justify-center bg-[#E3F6F3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/simbolo.png" alt="" width={771} height={668} loading="lazy" className="h-24 w-auto opacity-90" />
                </div>
              )}
              <div className="p-5">
                <h3 className="font-destaque text-[17px] font-bold text-[#354746]">{t.nome}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4A5F5D]">{t.texto}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#5E7371]">Imagens ilustrativas.</p>
      </section>

      {/* 5. COMO FUNCIONA A AVALIAÇÃO */}
      <section className="border-y border-[#DCE8E5] bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">
            Como funciona a avaliação
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="text-[16px] leading-relaxed text-[#4A5F5D]">
                Cada sessão dura 60 minutos e é individual: você é atendido do começo ao fim pelo próprio
                fisioterapeuta. Na primeira vez, a avaliação e o tratamento acontecem no mesmo encontro, a partir do
                que o exame mostrar. O tratamento indicado depende de cada pessoa e não há promessa de resultado.
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-[#4A5F5D]">
                Traga exames, se tiver, e use roupa confortável e folgada. Não é preciso pedido médico para começar.
              </p>
            </div>
            <div className="rounded-2xl border border-[#DCE8E5] bg-white p-6">
              <h3 className="text-[17px] font-semibold text-[#354746]">Quem atendemos</h3>
              <ul className="mt-3 space-y-2 text-[15px] text-[#4A5F5D]">
                {PUBLICOS.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#1EB49F]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[14px] leading-relaxed text-[#5E7371]">
                Pagamento por Pix ou em dinheiro; não trabalhamos com convênios.
              </p>
            </div>
          </div>
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {passos.map((p) => (
              <li key={p.n} className="rounded-2xl border border-[#DCE8E5] bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3F6F3] font-destaque text-[16px] font-bold text-[#0F7F70]">
                  {p.n}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[#354746]">{p.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A5F5D]">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. LOCAIS DE ATENDIMENTO */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">
          Locais de atendimento em Florianópolis
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[CONSULTORIOS.capoeiras, CONSULTORIOS.centro].map((c) => (
            <article key={c.id} className="rounded-2xl border border-[#DCE8E5] bg-white p-6">
              <h3 className="font-destaque text-[19px] font-bold text-[#354746]">{c.nome}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4A5F5D]">{c.linhaEndereco}</p>
              {c.cep ? <p className="text-[14px] text-[#5E7371]">CEP {c.cep}</p> : null}
              <div className="mt-4 flex flex-wrap gap-4 text-[14.5px] font-bold">
                <a href={c.mapaUrl} target="_blank" rel="noopener noreferrer" className="text-[#0F7F70] hover:underline">
                  Abrir no mapa
                </a>
                <Link href={`/${c.id}`} className="text-[#0F7F70] hover:underline">
                  Como chegar
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 7/8. REDES, DÚVIDAS, CONTATO E AGENDAMENTO */}
      <section className="mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <p className="text-[15px] font-semibold text-[#354746]">Acompanhe também nas redes</p>
        <RedesSociais comTexto className="mt-3" />
        <p className="mt-4 text-[14.5px] text-[#4A5F5D]">
          Ficou com alguma dúvida?{" "}
          <Link href="/duvidas" className="font-bold text-[#0F7F70] hover:underline">
            Veja as dúvidas frequentes
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-4 pt-6 sm:px-6">
        <div className="rounded-3xl bg-[#354746] px-6 py-10 text-white sm:px-10">
          <h2 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">Pronto para agendar a sua avaliação?</h2>
          <p className="mt-3 max-w-xl text-[16px] text-white/85">
            Escolha o consultório e os dias que ficam melhores. O Anderson confirma o horário com você pelo WhatsApp.
          </p>
          <Link
            href="/agendar"
            className="mt-6 inline-flex rounded-2xl bg-white px-7 py-4 text-[16px] font-bold text-[#0F7F70] transition hover:bg-[#E3F6F3]"
          >
            Agende sua avaliação
          </Link>
        </div>
      </section>
    </>
  );
}
