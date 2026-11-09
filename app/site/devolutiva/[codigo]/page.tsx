import type { Metadata } from "next";
import { CREFITO, HORARIO_TEXTO, MARCA, PROFISSIONAL, SITE_URL, SLOGAN, whatsappNumero } from "@/lib/site";
import { devolutivaPublica, type PontoDor } from "@/lib/devolutivas";
import { BotaoImprimir } from "@/components/site/BotaoImprimir";

export const dynamic = "force-dynamic";

// Documento PRIVADO do paciente (link com código secreto): fora do Google e das ferramentas de medição.
export const metadata: Metadata = {
  title: "Devolutiva do seu caso",
  robots: { index: false, follow: false, nocache: true },
};

const dataBR = (iso: string) => {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00-03:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Gráfico simples da dor (0 a 10) ao longo das sessões. */
function GraficoDor({ pontos }: { pontos: PontoDor[] }) {
  const larg = 640;
  const alt = 210;
  const m = { e: 36, d: 16, t: 14, b: 34 };
  const n = pontos.length;
  const x = (i: number) => m.e + (n === 1 ? (larg - m.e - m.d) / 2 : (i * (larg - m.e - m.d)) / (n - 1));
  const y = (v: number) => m.t + ((10 - v) * (alt - m.t - m.b)) / 10;
  const serie = (pegar: (p: PontoDor) => number | null) =>
    pontos.map((p, i) => ({ i, v: pegar(p) })).filter((q): q is { i: number; v: number } => q.v != null);
  const ini = serie((p) => p.inicio);
  const fim = serie((p) => p.fim);
  const linha = (s: { i: number; v: number }[]) => s.map((q, k) => `${k ? "L" : "M"}${x(q.i).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${larg} ${alt}`} className="mt-3 w-full" role="img" aria-label="Evolução da dor ao longo das sessões">
      {[0, 2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={m.e} x2={larg - m.d} y1={y(v)} y2={y(v)} stroke="#E3ECEA" />
          <text x={m.e - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5E7371">
            {v}
          </text>
        </g>
      ))}
      {ini.length > 1 && <path d={linha(ini)} fill="none" stroke="#1EB49F" strokeWidth="2.5" />}
      {fim.length > 1 && <path d={linha(fim)} fill="none" stroke="#354746" strokeWidth="2" strokeDasharray="5 4" />}
      {ini.map((q) => (
        <circle key={`i${q.i}`} cx={x(q.i)} cy={y(q.v)} r="4.5" fill="#1EB49F" />
      ))}
      {fim.map((q) => (
        <circle key={`f${q.i}`} cx={x(q.i)} cy={y(q.v)} r="3.5" fill="#354746" />
      ))}
      {pontos.map((p, i) => (
        <text key={p.data + i} x={x(i)} y={alt - 12} textAnchor="middle" fontSize="11" fill="#5E7371">
          {dataBR(p.data).slice(0, 5)}
        </text>
      ))}
    </svg>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-7 break-inside-avoid">
      <h2 className="border-b border-[#D8E4E1] pb-1.5 text-[17px] font-semibold text-[#354746]">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default async function Devolutiva({ params }: { params: { codigo: string } }) {
  const d = await devolutivaPublica(params.codigo);
  const wa = `https://wa.me/${whatsappNumero()}`;

  if (!d) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
        <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746]">Este link não está mais ativo</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[#3F5452]">O documento foi encerrado ou o endereço está incompleto. Fale com o Anderson pelo WhatsApp para receber o link atualizado.</p>
        <a href={wa} className="mt-6 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white">
          Falar pelo WhatsApp
        </a>
      </section>
    );
  }

  const texto = "whitespace-pre-wrap text-[15.5px] leading-relaxed text-[#3F5452]";
  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <style>{`@media print{header,footer,[data-no-print]{display:none!important}body{background:#fff!important}}`}</style>

      {/* Papel timbrado */}
      <div className="flex items-center gap-4 border-b-2 border-[#1EB49F] pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/simbolo.png" alt="" width={56} height={56} className="h-14 w-14" />
        <div>
          <p className="font-destaque text-[20px] font-bold leading-tight text-[#354746]">{MARCA}</p>
          <p className="text-[13px] text-[#5E7371]">{SLOGAN}</p>
        </div>
      </div>

      <h1 className="font-destaque mt-6 text-[26px] font-bold leading-tight tracking-tight text-[#354746] sm:text-[34px]">{d.titulo}</h1>
      <p className="mt-1 text-[14px] text-[#5E7371]">
        {d.primeiroNome ? `Para ${d.primeiroNome} · ` : ""}
        {dataBR(d.criado_em)} · {PROFISSIONAL} · {CREFITO}
      </p>

      {d.relato && (
        <Secao titulo="O que você nos contou">
          <p className={texto}>{d.relato}</p>
        </Secao>
      )}

      {d.exames.length > 0 && (
        <Secao titulo="O que os seus exames descrevem">
          <ul className="space-y-4">
            {d.exames.map((e, i) => (
              <li key={i} className="rounded-xl border border-[#D8E4E1] bg-[#F5F8F7] p-4">
                <p className="text-[15.5px] font-semibold text-[#354746]">
                  {e.titulo}
                  {e.data ? <span className="ml-2 text-[13px] font-normal text-[#5E7371]">{dataBR(e.data)}</span> : null}
                </p>
                <p className={`${texto} mt-1.5`}>{e.resumo}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-[#5E7371]">Resumo do que o laudo descreve. O que cada achado significa no seu caso é visto junto com a avaliação clínica.</p>
        </Secao>
      )}

      {d.achados && (
        <Secao titulo="O que encontramos na avaliação">
          <p className={texto}>{d.achados}</p>
        </Secao>
      )}

      {d.plano && (
        <Secao titulo="Plano de cuidado">
          <p className={texto}>{d.plano}</p>
        </Secao>
      )}

      {d.mostrar_dor && d.dor.length > 0 && (
        <Secao titulo="Como a sua dor tem evoluído">
          <p className="text-[14px] text-[#5E7371]">Nota de 0 (sem dor) a 10 (a pior dor), registrada em cada sessão.</p>
          <GraficoDor pontos={d.dor} />
          <p className="mt-1 flex flex-wrap gap-x-5 text-[12.5px] text-[#5E7371]">
            <span>
              <b className="text-[#1EB49F]">●</b> início da sessão
            </span>
            <span>
              <b className="text-[#354746]">●</b> fim da sessão
            </span>
          </p>
        </Secao>
      )}

      {d.prescricao_codigo && (
        <Secao titulo="Exercícios para fazer em casa">
          <p className={texto}>Preparei um plano de exercícios com vídeos para você continuar o cuidado em casa.</p>
          <a
            href={`${SITE_URL}/exercicios/${d.prescricao_codigo}`}
            className="mt-3 inline-flex items-center rounded-full bg-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#189B89]"
            data-no-print
          >
            Abrir o plano de exercícios
          </a>
        </Secao>
      )}

      {d.observacoes && (
        <Secao titulo="Observações">
          <p className={texto}>{d.observacoes}</p>
        </Secao>
      )}

      <div className="mt-10 border-t border-[#D8E4E1] pt-5 text-[13.5px] leading-relaxed text-[#5E7371]">
        <p className="font-semibold text-[#354746]">
          {PROFISSIONAL} · Fisioterapeuta · {CREFITO}
        </p>
        <p>{HORARIO_TEXTO}</p>
        <p className="mt-3">
          Este documento é informativo, foi feito para o seu caso e não substitui a consulta. Não traz promessa de resultado. Você pode compartilhá-lo com outros profissionais de saúde
          que cuidam de você.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3" data-no-print>
        <BotaoImprimir rotulo="Salvar em PDF / imprimir" />
        <a href={wa} className="inline-flex items-center rounded-full border border-[#1EB49F] px-6 py-3 text-[15px] font-semibold text-[#1EB49F] transition hover:bg-[#1EB49F] hover:text-white">
          Falar com o Anderson no WhatsApp
        </a>
      </div>
    </section>
  );
}
