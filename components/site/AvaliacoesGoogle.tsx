import { DEPOIMENTOS_AUTORIZADOS } from "@/lib/depoimentos";
import { CREFITO, GOOGLE_ATUALIZADO, GOOGLE_AVALIACOES_URL, GOOGLE_NOTA, GOOGLE_TOTAL, PROFISSIONAL } from "@/lib/site";

function Estrelas() {
  return (
    <span aria-hidden className="text-[22px] tracking-[2px] text-[#E9A92B]">
      ★★★★★
    </span>
  );
}

export function AvaliacoesGoogle() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6" aria-labelledby="avaliacoes">
      <h2 id="avaliacoes" className="text-[26px] font-semibold tracking-tight text-[#354746] sm:text-[32px]">
        O que dizem no Google
      </h2>
      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-[#DCE8E5] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="font-destaque text-[44px] font-bold leading-none text-[#354746]">{GOOGLE_NOTA}</span>
          <div>
            <Estrelas />
            <p className="text-[15px] text-[#4A5F5D]">
              {GOOGLE_TOTAL} avaliações no Google
              <span className="block text-[12.5px] text-[#5E7371]">Nota conferida em {GOOGLE_ATUALIZADO}.</span>
            </p>
          </div>
        </div>
        <a
          href={GOOGLE_AVALIACOES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-2xl border border-[#1EB49F] px-6 py-3.5 text-[15px] font-bold text-[#0F7F70] hover:bg-[#E3F6F3]"
        >
          Ver todas as avaliações no Google
        </a>
      </div>

      {DEPOIMENTOS_AUTORIZADOS.length > 0 ? (
        <>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2">
            {DEPOIMENTOS_AUTORIZADOS.map((d) => (
              <li key={d.nome + d.data} className="rounded-2xl border border-[#DCE8E5] bg-white p-6">
                <Estrelas />
                <blockquote className="mt-2 text-[15.5px] leading-relaxed text-[#3F5452]">“{d.texto}”</blockquote>
                <p className="mt-3 text-[13.5px] text-[#5E7371]">
                  {d.nome} · {d.data}
                  {d.link ? (
                    <>
                      {" · "}
                      <a href={d.link} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0F7F70] hover:underline">
                        ver no Google
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-[#5E7371]">
            Depoimentos publicados com autorização de quem os escreveu. {PROFISSIONAL}, {CREFITO}. Cada pessoa responde de
            um jeito ao tratamento; não há garantia de resultado.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-[#5E7371]">
          As avaliações são escritas por pacientes diretamente no Google, e você pode ler todas lá. Cada pessoa responde de
          um jeito ao tratamento; não há garantia de resultado.
        </p>
      )}
    </section>
  );
}
