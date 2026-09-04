"use client";

import { useState } from "react";
import Link from "next/link";
import { LeadRow } from "@/lib/types";
import { formatPhone, relativeTime, formatDateTime, initials } from "@/lib/format";
import { StageBadge } from "./StageBadge";
import { PerfilBadge } from "./PerfilBadge";
import { OrigemBadge } from "./OrigemBadge";
import { ResultadoBadge } from "./ResultadoBadge";
import { EmptyState } from "./EmptyState";
import { stageMeta } from "@/lib/theme";
import { Sigilo } from "./Sigilo";

/**
 * Resultado da busca de /leads.
 *
 * Duas formas, não uma tabela que encolhe: abaixo de `md` cada lead é um CARTÃO;
 * de `md` pra cima, a tabela de 12 colunas de sempre. A tabela tem 1220px de
 * largura mínima — num celular de 375px o consultor via menos de um terço da
 * linha e, ao arrastar atrás de "Desfecho", perdia o nome e o cabeçalho ao mesmo
 * tempo, ficando com células soltas sem saber de quem eram.
 *
 * Renderiza em páginas de 50. Antes saíam todas as linhas de uma vez — a
 * consulta traz até 1000 (teto do PostgREST), o que dava ~12 mil células no DOM
 * numa página só, em 4G e num Android intermediário.
 */

const POR_PAGINA = 50;

function Cnpj({ v }: { v: boolean | null }) {
  if (v === true)
    return (
      <span className="inline-flex items-center text-brand" title="Possui CNPJ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4 4 10-10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">Sim</span>
      </span>
    );
  return (
    <span className="text-ink-faint" title="Sem CNPJ informado">
      —
    </span>
  );
}

function LocalCell({ cidade, uf }: { cidade: string | null; uf: string | null }) {
  if (!cidade && !uf) return <span className="text-ink-faint">—</span>;
  return (
    <span className="text-[12.5px] text-ink-muted">
      {cidade ?? "—"}
      {uf && (
        <span className="ml-1 rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-ink-faint">
          {uf}
        </span>
      )}
    </span>
  );
}

// A coluna "Consultor" só aparece quando há mais de um dono na lista — com um
// consultor só, ela seria uma coluna inteira repetindo a mesma palavra.
const COLS = [
  { h: "Lead", align: "left" },
  { h: "Consultor", align: "left" },
  { h: "Telefone", align: "left" },
  { h: "Categoria", align: "left" },
  { h: "Cidade/UF", align: "left" },
  { h: "Estágio", align: "left" },
  { h: "Desfecho", align: "left" },
  { h: "CNPJ", align: "center" },
  { h: "Origem", align: "left" },
  { h: "Marca atual", align: "left" },
  { h: "Última interação", align: "left" },
  { h: "Follow-ups", align: "right" },
] as const;

// Nome de exibição do consultor a partir do slug (capitaliza; o nome completo
// vive na tabela `vendedores` e não vale uma consulta a mais só pra tabela).
function nomeConsultor(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Cartão de um lead — a forma da lista no celular. */
function CardLead({
  l,
  etapas,
}: {
  l: LeadRow;
  etapas?: { key: string; label: string; color: string }[];
}) {
  const meta = stageMeta(l.funnel_stage);
  return (
    <li className="card-surface rounded-xl border border-line p-3">
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tag-ink"
          style={{ "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties}
        >
          <Sigilo>{initials(l.nome)}</Sigilo>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">
            <Sigilo>{l.nome?.trim() || <span className="text-ink-faint">Sem nome</span>}</Sigilo>
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-ink-muted"><Sigilo>{formatPhone(l.telefone)}</Sigilo></p>
        </div>
        <span
          className="shrink-0 text-[11px] text-ink-muted"
          title={formatDateTime(l.ultima_interacao)}
        >
          {relativeTime(l.ultima_interacao)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StageBadge stage={l.funnel_stage} size="sm" etapas={etapas} />
        <PerfilBadge perfil={l.perfil} size="sm" />
        {l.resultado && <ResultadoBadge resultado={l.resultado} size="sm" />}
        {(l.cidade || l.uf) && <LocalCell cidade={l.cidade} uf={l.uf} />}
        {l.vendedor_slug && (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-ink-muted">
            {nomeConsultor(l.vendedor_slug)}
          </span>
        )}
      </div>

      {/* Responder estava só em /prioridades e /atendimento: da página de menu
          mais óbvia — a que se chama "Leads" — responder custava três telas. */}
      <div className="mt-2.5 flex gap-2">
        <Link
          href={`/leads/${encodeURIComponent(l.telefone)}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line text-[13px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Abrir ficha
        </Link>
        <Link
          href={`/conversas?tel=${encodeURIComponent(l.telefone)}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-brand/10 text-[13px] font-semibold text-brand ring-1 ring-inset ring-brand/25 transition hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Responder
        </Link>
      </div>
    </li>
  );
}

export function LeadsDirectory({
  leads,
  etapas,
}: {
  leads: LeadRow[];
  /** Etapas dinâmicas do funil (rename/cor do admin refletem no badge). */
  etapas?: { key: string; label: string; color: string }[];
}) {
  const [limite, setLimite] = useState(POR_PAGINA);

  if (!leads.length) {
    return (
      <EmptyState
        title="Nenhum lead encontrado"
        hint="Ajuste a busca ou os filtros para ver outros leads."
      />
    );
  }

  const visiveis = leads.slice(0, limite);
  const restantes = leads.length - visiveis.length;

  return (
    <div>
      {/* Cartões — abaixo de md */}
      <ul className="flex flex-col gap-2 md:hidden">
        {visiveis.map((l, idx) => (
          <CardLead key={l.telefone + idx} l={l} etapas={etapas} />
        ))}
      </ul>

      {/* Tabela — md pra cima. A altura máxima existe para o cabeçalho sticky
          FUNCIONAR: `overflow-x: auto` faz o overflow-y computar para auto, então
          o container de rolagem do sticky passa a ser esta div — e sem altura
          limitada ela nunca rola por dentro, ou seja, o cabeçalho nunca grudava. */}
      <div className="scroll-slim -mx-1 hidden overflow-x-auto md:block md:max-h-[calc(100dvh-280px)] md:overflow-y-auto">
        <table className="w-full min-w-[1220px] border-separate border-spacing-0">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.h}
                  scope="col"
                  className={`sticky top-0 z-10 border-b border-line bg-surface/95 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted backdrop-blur ${
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, idx) => {
              const meta = stageMeta(l.funnel_stage);
              return (
                <tr
                  key={l.telefone + idx}
                  className="group transition-colors hover:bg-white/[0.02]"
                >
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <Link
                      href={`/leads/${encodeURIComponent(l.telefone)}`}
                      className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      <span
                        className="tag-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={
                          { "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties
                        }
                      >
                        <Sigilo>{initials(l.nome)}</Sigilo>
                      </span>
                      <span className="text-[13px] text-ink group-hover:text-brand">
                        <Sigilo>{l.nome?.trim() || <span className="text-ink-faint">—</span>}</Sigilo>
                      </span>
                    </Link>
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    {l.vendedor_slug ? (
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-ink-muted">
                        {nomeConsultor(l.vendedor_slug)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <span className="font-mono text-[12px] text-ink-muted">
                      <Sigilo>{formatPhone(l.telefone)}</Sigilo>
                    </span>
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <PerfilBadge perfil={l.perfil} size="sm" />
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <LocalCell cidade={l.cidade} uf={l.uf} />
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <StageBadge stage={l.funnel_stage} size="sm" etapas={etapas} />
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <ResultadoBadge resultado={l.resultado} size="sm" />
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5 text-center">
                    <div className="flex justify-center">
                      <Cnpj v={l.cnpj} />
                    </div>
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <OrigemBadge campanha={l.origem_campanha} ad={l.origem_ad} size="sm" />
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <span className="text-[12.5px] text-ink-muted">
                      {l.marca_atual?.trim() || <span className="text-ink-faint">—</span>}
                    </span>
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5">
                    <span
                      className="text-[12.5px] text-ink-muted"
                      title={formatDateTime(l.ultima_interacao)}
                    >
                      {relativeTime(l.ultima_interacao)}
                    </span>
                  </td>
                  <td className="border-b border-line/50 px-3 py-2.5 text-right">
                    <span
                      className={`tnum inline-flex min-w-[26px] items-center justify-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
                        l.followup_count > 0 ? "bg-amber/10 text-amber" : "text-ink-faint"
                      }`}
                    >
                      {l.followup_count}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {restantes > 0 && (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLimite((v) => v + POR_PAGINA)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-[13px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Carregar mais {Math.min(restantes, POR_PAGINA)}
          </button>
          <p className="text-[11.5px] text-ink-muted">
            Mostrando {visiveis.length} de {leads.length}.
          </p>
        </div>
      )}
    </div>
  );
}
