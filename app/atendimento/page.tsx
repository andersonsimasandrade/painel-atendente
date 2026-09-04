import Link from "next/link";
import { getEsperando } from "@/lib/db";
import { getAtendimentoStats, formatMin } from "@/lib/atendimento";
import { formatNumber, formatPhone, initials, relativeTime } from "@/lib/format";
import { SubNav } from "@/components/SubNav";
import { LiveStatus } from "@/components/LiveStatus";
import { Panel } from "@/components/Panel";
import { DbErrorState } from "@/components/DbErrorState";
import { EmptyState } from "@/components/EmptyState";
import { FiltroConsultor } from "@/components/FiltroConsultor";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";
import { listarVendedores } from "@/lib/agenda";
import { Sigilo } from "@/components/Sigilo";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Cartão de indicador (mesma linguagem visual do KpiRow, sem link obrigatório).
function StatCard({
  label,
  value,
  sub,
  tone = "default",
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "brand" | "amber";
  delay?: number;
}) {
  const accent =
    tone === "brand" ? "before:bg-brand" : tone === "amber" ? "before:bg-amber" : "before:bg-line-strong";
  return (
    <div
      className={`card-surface animate-fade-up relative overflow-hidden rounded-2xl border border-line p-4 shadow-card sm:p-5 before:absolute before:left-0 before:top-4 before:h-[calc(100%-2rem)] before:w-[3px] before:rounded-full ${accent}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="pl-2 text-[12px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <div className="mt-2 pl-2">
        <div className="tnum font-display text-[28px] font-semibold leading-none tracking-tight text-ink sm:text-[32px]">
          {value}
        </div>
        {sub && <p className="mt-1.5 text-[12px] text-ink-muted">{sub}</p>}
      </div>
    </div>
  );
}

const HORAS_ALERTA = 2; // esperando há mais do que isso = destaque âmbar
const FILA_EXIBIR = 30;

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: { periodo?: string | string[]; consultor?: string | string[] };
}) {
  const sess = await getSessao();
  const dias = sp(searchParams.periodo) === "30" ? 30 : 7;

  // A lista de consultores vem ANTES para validar o ?consultor= da URL: um slug
  // lixo (typo, link velho) vira "Todos" em vez de zerar a página inteira.
  // Fail-closed: só admin recebe o roster (sessão revogada/papel novo, não).
  const consultores = sess?.papel === "admin" ? await listarVendedores() : [];
  const urlConsultor = sp(searchParams.consultor);
  const consultorOk =
    urlConsultor && consultores.some((c) => c.slug === urlConsultor)
      ? urlConsultor
      : undefined;
  const dono = escopoDaLista(sess, consultorOk);

  const [statsRes, filaRes] = await Promise.all([
    getAtendimentoStats(dias, dono),
    getEsperando(dono),
  ]);

  if (!statsRes.ok) return <DbErrorState error={statsRes.error} />;
  if (!filaRes.ok) return <DbErrorState error={filaRes.error} />;
  const { stats } = statsRes;

  // Fila de espera AGORA (censo completo via RPC, independe da janela):
  // mais antigas primeiro.
  const agora = Date.now();
  const nomeConsultor = (slug: string | null): string | null => {
    if (!slug) return null;
    return (
      consultores.find((c) => c.slug === slug)?.nome ??
      slug.charAt(0).toUpperCase() + slug.slice(1)
    );
  };
  const esperando = filaRes.fila
    .map((c) => {
      const t = c.ultima_interacao ? Date.parse(c.ultima_interacao) : NaN;
      return { ...c, horas: Number.isFinite(t) ? (agora - t) / 3600000 : 0 };
    })
    .sort((a, b) => b.horas - a.horas);
  const esperandoCritico = esperando.filter((c) => c.horas >= HORAS_ALERTA).length;

  // Preserva o consultor selecionado nos links de período.
  const qs = (periodo: number) => {
    const p = new URLSearchParams();
    if (periodo !== 7) p.set("periodo", String(periodo));
    if (consultorOk) p.set("consultor", consultorOk);
    const s = p.toString();
    return s ? `/atendimento?${s}` : "/atendimento";
  };

  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav
        title="Atendimento"
        subtitle="Velocidade e produção do atendimento humano"
        right={
          <>
            <FiltroConsultor consultores={consultores} atual={consultorOk} />
            <LiveStatus generatedAt={statsRes.generatedAt} />
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Janela de análise */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[12px] text-ink-faint">Janela:</span>
          {[7, 30].map((p) => (
            <Link
              key={p}
              href={qs(p)}
              aria-current={dias === p ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium leading-none ring-1 ring-inset transition ${
                dias === p
                  ? "bg-brand/15 text-brand ring-brand/25"
                  : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
              }`}
            >
              {p} dias
            </Link>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          <StatCard
            label="Tempo de resposta humana"
            value={formatMin(stats.medianaMin)}
            sub={
              stats.paresResposta
                ? `mediana de ${formatNumber(stats.paresResposta)} respostas · 90% em até ${formatMin(stats.p90Min)}`
                : "sem pares medidos na janela"
            }
            tone="brand"
            delay={0}
          />
          <StatCard
            label="Esperando resposta agora"
            value={formatNumber(esperando.length)}
            sub={
              esperandoCritico > 0
                ? `${formatNumber(esperandoCritico)} há mais de ${HORAS_ALERTA}h`
                : "fila em dia"
            }
            tone={esperandoCritico > 0 ? "amber" : "default"}
            delay={60}
          />
          <StatCard
            label="Respostas humanas"
            value={formatNumber(stats.respostasHumanas)}
            sub={`painel + celular, últimos ${stats.dias} dias`}
            delay={120}
          />
          <StatCard
            label="Pós-transferência"
            value={formatMin(stats.medianaPosTransferMin)}
            sub={
              stats.transferidos
                ? `${formatNumber(stats.transferidos)} transferidos · ${formatNumber(stats.transferSemResposta)} sem resposta humana`
                : "nenhuma transferência na janela"
            }
            tone={stats.transferSemResposta > 0 ? "amber" : "default"}
            delay={180}
          />
        </div>

        {/* Por consultor */}
        <div className="mt-4">
          <Panel
            title="Por consultor"
            subtitle={`Últimos ${stats.dias} dias — respostas atribuídas ao consultor dono do lead`}
            delay={120}
          >
            {stats.porConsultor.length === 0 ? (
              consultorOk || dono ? (
                <EmptyState
                  title="Nenhum consultor corresponde ao filtro"
                  hint="Escolha outro consultor no seletor acima (ou Todos)."
                />
              ) : (
                <EmptyState title="Nenhum consultor ativo" hint="Cadastre consultores em Ajustes." />
              )
            ) : (
              <div className="scroll-slim -mx-1 overflow-x-auto">
                <table className="w-full min-w-[560px] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {["Consultor", "Leads atendidos", "Respostas", "Tempo de resposta (mediana)"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`border-b border-line px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint ${
                              i === 0 ? "text-left" : "text-right"
                            }`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porConsultor.map((c) => (
                      <tr key={c.slug} className="transition-colors hover:bg-white/[0.02]">
                        <td className="border-b border-line/50 px-3 py-2.5 text-[13px] text-ink">
                          {c.nome}
                        </td>
                        <td className="tnum border-b border-line/50 px-3 py-2.5 text-right text-[13px] text-ink-muted">
                          {formatNumber(c.leadsAtendidos)}
                        </td>
                        <td className="tnum border-b border-line/50 px-3 py-2.5 text-right text-[13px] text-ink-muted">
                          {formatNumber(c.respostas)}
                        </td>
                        <td className="tnum border-b border-line/50 px-3 py-2.5 text-right text-[13px] text-ink">
                          {formatMin(c.medianaMin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Fila de espera */}
        <div className="mt-4">
          <Panel
            title="Esperando resposta agora"
            subtitle={`Base completa — conversas em que o cliente falou por último, mais antigas primeiro (destaque a partir de ${HORAS_ALERTA}h)`}
            delay={180}
          >
            {esperando.length === 0 ? (
              <EmptyState
                title="Ninguém esperando 🎉"
                hint="Toda mensagem de cliente já foi respondida ou marcada como lida."
              />
            ) : (
              <ul className="flex flex-col">
                {esperando.slice(0, FILA_EXIBIR).map((c) => {
                  const critico = c.horas >= HORAS_ALERTA;
                  const consultor = nomeConsultor(c.vendedor_slug);
                  return (
                    <li
                      key={c.telefone}
                      className="flex flex-wrap items-center gap-3 border-b border-line/50 py-2.5 last:border-b-0"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold ${
                          critico ? "bg-amber/15 text-amber" : "bg-white/[0.05] text-ink-muted"
                        }`}
                      >
                        <Sigilo>{initials(c.nome)}</Sigilo>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-ink">
                          <Sigilo>{c.nome?.trim() || formatPhone(c.telefone)}</Sigilo>
                        </span>
                        <span className="block font-mono text-[11px] text-ink-faint">
                          <Sigilo>{formatPhone(c.telefone)}</Sigilo>
                          {consultor && ` · ${consultor}`}
                        </span>
                      </span>
                      <span
                        className={`ml-auto text-[12.5px] ${critico ? "font-medium text-amber" : "text-ink-muted"}`}
                        title={c.ultima_interacao ?? undefined}
                      >
                        esperando {relativeTime(c.ultima_interacao)}
                      </span>
                      <Link
                        href={`/conversas?tel=${encodeURIComponent(c.telefone)}`}
                        className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
                      >
                        Responder
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {esperando.length > FILA_EXIBIR && (
              <p className="mt-2 text-[11.5px] text-ink-faint">
                Mostrando as {FILA_EXIBIR} esperas mais antigas de{" "}
                {formatNumber(esperando.length)}. Marcar como lida no inbox tira a
                conversa da fila.
              </p>
            )}
          </Panel>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-ink-faint sm:flex-row">
          <span>
            {empresaNome()} · Indicadores de atendimento — respostas do bot não contam;
            só gente (painel/celular)
          </span>
        </footer>
      </main>
    </div>
  );
}
