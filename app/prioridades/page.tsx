import Link from "next/link";
import { getPrioridades, getPlanoAcao } from "@/lib/db";
import { formatPhone, relativeTime, initials } from "@/lib/format";
import { SubNav } from "@/components/SubNav";
import { Panel } from "@/components/Panel";
import { StageBadge } from "@/components/StageBadge";
import { PerfilBadge } from "@/components/PerfilBadge";
import { EmptyState } from "@/components/EmptyState";
import { AtualizarAnalises } from "@/components/AtualizarAnalises";
import { PrioridadeLead } from "@/lib/types";
import { getSessao } from "@/lib/session";
import { escopoDaLista } from "@/lib/escopo";
import { listarVendedores } from "@/lib/agenda";
import { FiltroConsultor } from "@/components/FiltroConsultor";
import { Sigilo } from "@/components/Sigilo";
import { empresaNome } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEMP: Record<"quente" | "morno" | "frio", { label: string; emoji: string; cls: string }> = {
  quente: { label: "Quente", emoji: "🔥", cls: "text-red-300 bg-red-500/12 ring-red-500/25" },
  morno: { label: "Morno", emoji: "🌤️", cls: "text-amber bg-amber/10 ring-amber/25" },
  frio: { label: "Frio", emoji: "❄️", cls: "text-sky-300 bg-sky-500/12 ring-sky-500/25" },
};

function TempBadge({ t }: { t: "quente" | "morno" | "frio" }) {
  const m = TEMP[t];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ring-1 ring-inset ${m.cls}`}
    >
      {m.emoji} {m.label}
    </span>
  );
}

// O card inteiro leva ao Lead 360 (link "esticado" pelo nome), e o botão
// Responder — a ação mais frequente — abre a conversa direto no inbox.
function LeadCard({ p }: { p: PrioridadeLead }) {
  return (
    <div className="relative rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-display text-[12px] font-semibold text-ink-muted">
          <Sigilo>{initials(p.nome)}</Sigilo>
        </span>
        <div className="min-w-0">
          <Link
            href={`/leads/${encodeURIComponent(p.telefone)}`}
            className="block truncate text-[14px] font-semibold text-ink after:absolute after:inset-0 after:rounded-2xl hover:text-brand"
          >
            <Sigilo>{p.nome || "Lead sem nome"}</Sigilo>
          </Link>
          <p className="font-mono text-[11.5px] text-ink-faint"><Sigilo>{formatPhone(p.telefone)}</Sigilo></p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {p.temperatura && <TempBadge t={p.temperatura} />}
          {p.funnel_stage && <StageBadge stage={p.funnel_stage} />}
        </div>
      </div>

      {p.resumo && (
        <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{p.resumo}</p>
      )}

      {p.proxima_acao && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2">
          <span className="mt-[1px] text-brand">➜</span>
          <p className="text-[12.5px] text-ink">{p.proxima_acao}</p>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-faint">
        {(p.cidade || p.uf) && (
          <span>
            {p.cidade ?? ""}
            {p.uf ? ` · ${p.uf}` : ""}
          </span>
        )}
        <span>últ. contato {relativeTime(p.ultima_interacao)}</span>
        <Link
          href={`/conversas?tel=${encodeURIComponent(p.telefone)}`}
          className="relative z-10 ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-[#04140d] transition hover:bg-brand-bright"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Responder
        </Link>
      </div>
    </div>
  );
}

export default async function PrioridadesPage({
  searchParams,
}: {
  searchParams: { consultor?: string };
}) {
  const sess = await getSessao();
  const dono = escopoDaLista(sess, searchParams?.consultor);
  // O plano é do MESMO escopo da lista (senão citaria lead de outro consultor).
  const [leads, plano, consultores] = await Promise.all([
    getPrioridades(dono),
    getPlanoAcao(dono ?? ""),
    // `=== "admin"`, nunca `!== "vendedor"`: papel 'revogado' (consultor
    // desligado) caía no else e recebia o time inteiro. Mesma regra que
    // /leads, /conversas, /funil e /atendimento já aplicam — e que
    // lib/escopo.ts documenta.
    sess?.papel === "admin" ? listarVendedores() : Promise.resolve([]),
  ]);
  const analisados = leads.filter((l) => l.resumo);
  const semAnalise = leads.length - analisados.length;
  const cont = {
    quente: analisados.filter((l) => l.temperatura === "quente").length,
    morno: analisados.filter((l) => l.temperatura === "morno").length,
    frio: analisados.filter((l) => l.temperatura === "frio").length,
  };

  return (
    <div className="relative z-[1] min-h-screen">
      {/* Pro consultor, /prioridades É o destino do voltar — o link apontava
          pra própria página. Pro admin, "< Dashboard" continua valendo. */}
      <SubNav
        title="Prioridades"
        subtitle="O que fazer com cada lead, priorizado por IA"
        back={sess?.papel === "vendedor" ? null : "/"}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Ação + contadores */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-2.5 py-1 text-[12px] font-semibold text-red-300 ring-1 ring-inset ring-red-500/25">
              🔥 {cont.quente} quente{cont.quente !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-1 text-[12px] font-semibold text-amber ring-1 ring-inset ring-amber/25">
              🌤️ {cont.morno} morno{cont.morno !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/12 px-2.5 py-1 text-[12px] font-semibold text-sky-300 ring-1 ring-inset ring-sky-500/25">
              ❄️ {cont.frio} frio{cont.frio !== 1 ? "s" : ""}
            </span>
            {semAnalise > 0 && (
              <span className="text-[11.5px] text-ink-faint">+{semAnalise} sem análise</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <FiltroConsultor consultores={consultores} atual={searchParams?.consultor} />
              <AtualizarAnalises />
            </div>
            <p className="text-[11px] text-ink-faint">
              {plano.gerado_em
                ? `Atualizado ${relativeTime(plano.gerado_em)}`
                : "Ainda não atualizado"}{" "}
              · atualiza sozinho a cada 2h
            </p>
          </div>
        </div>

        {/* Plano de ação */}
        <Panel title="Plano de ação" subtitle="Prioridades do dia, geradas por IA" className="mt-4" delay={80}>
          {plano.plano ? (
            <>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{plano.plano}</p>
              {plano.gerado_em && (
                <p className="mt-3 text-[11px] text-ink-faint">
                  Atualizado {relativeTime(plano.gerado_em)} · {plano.leads_analisados} leads · confira
                  antes de agir
                </p>
              )}
            </>
          ) : (
            <EmptyState
              title="Ainda sem plano"
              hint="Clique em “Atualizar análises” pra a IA ler os leads e montar as prioridades do dia."
            />
          )}
        </Panel>

        {/* Lista priorizada */}
        <div className="mt-4">
          <h3 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">
            Leads por prioridade
          </h3>
          {analisados.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {analisados.map((p) => (
                <LeadCard key={p.telefone} p={p} />
              ))}
            </div>
          ) : (
            <Panel>
              <EmptyState
                title="Nenhum lead analisado ainda"
                hint="Assim que você clicar em “Atualizar análises”, os leads aparecem aqui ordenados por temperatura."
              />
            </Panel>
          )}
        </div>

        <footer className="mt-8 border-t border-line pt-5 text-center text-[11px] text-ink-faint">
          {empresaNome()} · Central de prioridades — análises por IA (Groq, OpenAI de reserva)
        </footer>
      </main>
    </div>
  );
}
