import Link from "next/link";
import { CONSULTORIOS, HORARIO_TEXTO, type ConsultorioId } from "@/lib/site";

export function PaginaConsultorio({ id }: { id: ConsultorioId }) {
  const c = CONSULTORIOS[id];
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0F7F70]">
        Fisioterapia em {c.bairro}, Florianópolis
      </p>
      <h1 className="mt-3 font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        {c.nome}
      </h1>

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

      <div className="mt-8">
        <Link
          href="/agendar"
          className="inline-flex items-center justify-center rounded-2xl bg-[#0F7F70] px-7 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#0B6B5E]"
        >
          Agendar neste consultório
        </Link>
      </div>
    </section>
  );
}
