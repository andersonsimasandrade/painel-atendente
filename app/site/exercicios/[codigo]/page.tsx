import type { Metadata } from "next";
import { CREFITO, PROFISSIONAL, whatsappNumero } from "@/lib/site";
import { planoPublico } from "@/lib/exercicios";
import { videoEmbed } from "@/lib/exercicios-tipos";
import { FormCheckin } from "@/components/site/FormCheckin";

export const dynamic = "force-dynamic";

// Página PRIVADA do paciente (link com código secreto): fora do Google e sem rastreio de índice.
export const metadata: Metadata = {
  title: "Plano de exercícios",
  robots: { index: false, follow: false, nocache: true },
};

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function PlanoDeExercicios({ params }: { params: { codigo: string } }) {
  const plano = await planoPublico(params.codigo);
  const wa = `https://wa.me/${whatsappNumero()}`;

  if (!plano) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746]">Este link não está mais ativo</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[#3F5452]">
          O plano de exercícios foi encerrado ou o endereço está incompleto. Fale com o Anderson pelo WhatsApp para receber o link atualizado.
        </p>
        <a href={wa} className="mt-6 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white">
          Falar pelo WhatsApp
        </a>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-[#1EB49F]">Plano de exercícios para fazer em casa</p>
      <h1 className="font-destaque mt-2 text-[28px] font-bold leading-tight tracking-tight text-[#354746] sm:text-[38px]">
        {plano.primeiroNome ? `${plano.primeiroNome}, ` : ""}
        {plano.titulo}
      </h1>
      <p className="mt-2 text-[14px] text-[#5A6F6C]">Montado em {dataBR(plano.criado_em)} por {PROFISSIONAL} · {CREFITO}</p>

      {plano.orientacoes && (
        <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-[#D8E4E1] bg-[#F5F8F7] p-5 text-[15.5px] leading-relaxed text-[#354746]">{plano.orientacoes}</div>
      )}

      <ol className="mt-8 space-y-5">
        {plano.itens.map((it, i) => {
          const embed = videoEmbed(it.video_url);
          const dose = [
            it.series ? `${it.series} ${it.series === 1 ? "série" : "séries"}` : null,
            it.repeticoes ? (/^\d+$/.test(it.repeticoes) ? `${it.repeticoes} repetições` : it.repeticoes) : null,
            it.frequencia,
          ].filter(Boolean);
          return (
            <li key={i} className="rounded-2xl border border-[#D8E4E1] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1EB49F] text-[14px] font-bold text-white">{i + 1}</span>
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold leading-snug text-[#354746]">{it.nome}</h2>
                  {dose.length > 0 && <p className="mt-1 text-[14px] font-semibold text-[#1EB49F]">{dose.join(" · ")}</p>}
                </div>
              </div>
              {it.instrucoes && <p className="mt-3 whitespace-pre-wrap text-[15.5px] leading-relaxed text-[#3F5452]">{it.instrucoes}</p>}
              {it.observacao && <p className="mt-3 rounded-xl bg-[#FFF7E6] px-3 py-2 text-[14px] text-[#7A5200]">{it.observacao}</p>}
              {embed ? (
                <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <iframe
                    src={embed}
                    title={it.nome}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              ) : it.video_url ? (
                <a
                  href={it.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center rounded-full border border-[#1EB49F] px-5 py-2.5 text-[14.5px] font-semibold text-[#1EB49F] transition hover:bg-[#1EB49F] hover:text-white"
                >
                  ▶ Assistir ao vídeo
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-2xl border border-[#F0D9A8] bg-[#FFFBF0] p-5 text-[14.5px] leading-relaxed text-[#6B4E00]">
        <b>Cuidados:</b> este plano foi montado pelo seu fisioterapeuta para o seu caso. Faça no seu ritmo, sem forçar a dor. Se sentir dor forte, tontura, formigamento
        ou qualquer coisa diferente do esperado, pare e avise pelo WhatsApp. Em caso de urgência, procure um serviço de emergência.
      </div>

      <div className="mt-8">
        <FormCheckin codigo={params.codigo} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a href={wa} className="inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#189B89]">
          Falar com o Anderson no WhatsApp
        </a>
      </div>
    </section>
  );
}
