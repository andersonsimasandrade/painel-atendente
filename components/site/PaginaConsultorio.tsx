import Link from "next/link";
import { CONSULTORIOS, CREFITO, HORARIO_TEXTO, PROFISSIONAL, type ConsultorioId } from "@/lib/site";
import { listarPaginas, type PaginaResumo } from "@/lib/paginas";

export async function PaginaConsultorio({ id }: { id: ConsultorioId }) {
  const c = CONSULTORIOS[id];
  const outro = CONSULTORIOS[id === "capoeiras" ? "centro" : "capoeiras"];
  const ondeCurto = c.bairro === "Centro" ? "no Centro" : `em ${c.bairro}`;
  // Links para as páginas de serviço: ligam o bairro aos tratamentos (SEO local). Sem banco, a lista some.
  let paginas: PaginaResumo[] = [];
  try {
    paginas = await listarPaginas();
  } catch {
    paginas = [];
  }
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0F7F70]">{c.nome}</p>
      <h1 className="mt-3 font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        Fisioterapia {c.bairro === "Centro" ? "no Centro de Florianópolis" : `em ${c.bairro}, Florianópolis`}
      </h1>
      <p className="mt-4 text-[16.5px] leading-relaxed text-[#3F5452]">
        Consultório do fisioterapeuta {PROFISSIONAL} ({CREFITO}) {c.perto}. Atendimento individual, com hora
        marcada, para dor na coluna, no pescoço e nas articulações, com terapia manual, osteopatia e quiropraxia.
      </p>

      <div className="mt-8 rounded-2xl border border-[#DCE8E5] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#354746]">Endereço</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-[#3F5452]">{c.linhaEndereco}</p>
        {c.cep ? <p className="text-[14px] text-[#5E7371]">CEP {c.cep}</p> : null}
        <a
          href={c.mapaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl border border-[#1EB49F] px-4 py-2.5 text-[14.5px] font-semibold text-[#0F7F70] hover:bg-[#E3F6F3]"
        >
          Abrir no mapa
        </a>
      </div>

      <div className="mt-5 rounded-2xl border border-[#DCE8E5] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#354746]">Como funciona aqui</h2>
        <ul className="mt-3 space-y-2.5 text-[15.5px] leading-relaxed text-[#3F5452]">
          {c.comoChegar.map((t) => (
            <li key={t} className="flex gap-2.5">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#0F7F70]" />
              <span>{t}</span>
            </li>
          ))}
          <li className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#0F7F70]" />
            <span>{HORARIO_TEXTO}. Sessões de 60 minutos, individuais.</span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#0F7F70]" />
            <span>Use roupa confortável e folgada e traga seus exames, se tiver.</span>
          </li>
        </ul>
      </div>

      {paginas.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[#DCE8E5] bg-white p-6">
          <h2 className="text-[17px] font-semibold text-[#354746]">Atendimentos {ondeCurto}</h2>
          <ul className="mt-3 grid gap-2 text-[15.5px] sm:grid-cols-2">
            {paginas.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="font-medium text-[#0F7F70] underline-offset-2 hover:underline">
                  {p.rotulo || p.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/agendar"
          className="inline-flex items-center justify-center rounded-2xl bg-[#0F7F70] px-7 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#0B6B5E]"
        >
          Agendar neste consultório
        </Link>
        <Link href={`/${outro.id}`} className="text-[15px] font-semibold text-[#0F7F70] underline-offset-2 hover:underline">
          Ver também o {outro.nome}
        </Link>
      </div>
    </section>
  );
}
