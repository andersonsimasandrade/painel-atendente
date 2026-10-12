import Link from "next/link";
import { CONSULTORIOS, HORARIO_TEXTO, type ConsultorioId } from "@/lib/site";

export function PaginaConsultorio({ id }: { id: ConsultorioId }) {
  const c = CONSULTORIOS[id];
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2f9e5e]">
        Fisioterapia em {c.bairro}, Florianópolis
      </p>
      <h1 className="mt-3 font-display text-[30px] font-semibold leading-tight tracking-tight text-[#16351f] sm:text-[40px]">
        {c.nome}
      </h1>

      <div className="mt-8 rounded-2xl border border-[#e8e2d8] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#16351f]">Endereço</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-[#3a4a41]">{c.linhaEndereco}</p>
        {c.cep ? <p className="text-[14px] text-[#6b7a71]">CEP {c.cep}</p> : null}
        <a
          href={c.mapaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl border border-[#2f9e5e] px-4 py-2.5 text-[14.5px] font-semibold text-[#2f9e5e] hover:bg-[#e7f4ec]"
        >
          Abrir no mapa
        </a>
      </div>

      <div className="mt-5 rounded-2xl border border-[#e8e2d8] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#16351f]">Como funciona aqui</h2>
        <ul className="mt-3 space-y-2.5 text-[15.5px] leading-relaxed text-[#3a4a41]">
          {c.comoChegar.map((t) => (
            <li key={t} className="flex gap-2.5">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#2f9e5e]" />
              <span>{t}</span>
            </li>
          ))}
          <li className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#2f9e5e]" />
            <span>{HORARIO_TEXTO}. Sessões de 60 minutos, individuais.</span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#2f9e5e]" />
            <span>Use roupa confortável e folgada e traga seus exames, se tiver.</span>
          </li>
        </ul>
      </div>

      <div className="mt-8">
        <Link
          href="/agendar"
          className="inline-flex items-center justify-center rounded-2xl bg-[#2f9e5e] px-7 py-4 text-[16px] font-semibold text-white shadow-md transition hover:bg-[#278a50]"
        >
          Agendar neste consultório
        </Link>
      </div>
    </section>
  );
}
