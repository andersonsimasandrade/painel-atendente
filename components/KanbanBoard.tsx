"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LeadRow } from "@/lib/types";
import { resultadoTerminal } from "@/lib/theme";
import { formatPhone, initials, relativeTime } from "@/lib/format";
import { PerfilBadge } from "./PerfilBadge";
import { ResultadoBadge } from "./ResultadoBadge";
import { Sigilo } from "./Sigilo";

/**
 * Kanban do funil (/funil): uma coluna por etapa (funil_etapas — o admin
 * personaliza em Ajustes), cards arrastáveis. Soltar um card em outra coluna
 * chama a MESMA rota do ajuste manual de estágio (/api/lead/[tel]/estagio —
 * registra evento 'painel' na timeline e dispara a sequência da etapa, se
 * houver). Em celular o arrastar nativo não existe; o seletor no card cobre.
 */

const POR_COLUNA = 25; // cards visíveis por coluna antes do "mostrar todos"

interface CardErro {
  telefone: string;
  msg: string;
}

interface EtapaCol {
  key: string;
  label: string;
  color: string;
}

export function KanbanBoard({
  leads: initial,
  etapas,
}: {
  leads: LeadRow[];
  etapas: EtapaCol[];
}) {
  // Estágio desconhecido cai na PRIMEIRA coluna só VISUALMENTE — nunca
  // gravamos por causa disso (o guard do mover compara pela coluna exibida).
  const chaves = useMemo(() => new Set(etapas.map((e) => e.key)), [etapas]);
  const colunaDe = (stage: string): string =>
    chaves.has(stage) ? stage : etapas[0]?.key ?? "novo";
  const [leads, setLeads] = useState<LeadRow[]>(initial);
  const [busca, setBusca] = useState("");
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [sobre, setSobre] = useState<string | null>(null); // coluna sob o drag
  const [movendo, setMovendo] = useState<Set<string>>(new Set()); // telefones em POST
  const [erro, setErro] = useState<CardErro | null>(null);
  // Movimentos otimistas em voo — pra não serem desfeitos por um refresh do
  // servidor que chegue antes do POST terminar.
  const pendentes = useRef<Map<string, string>>(new Map());

  // O LiveStatus dá router.refresh() a cada 60s e o filtro de consultor troca
  // as props: ressincroniza o board sem perder busca/expansões nem os
  // movimentos ainda em voo.
  useEffect(() => {
    setLeads(
      initial.map((l) => {
        const emVoo = pendentes.current.get(l.telefone);
        return emVoo ? { ...l, funnel_stage: emVoo } : l;
      }),
    );
  }, [initial]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return leads.filter((l) => {
      // Só desfecho TERMINAL esconde ("em negociação"/"reunião agendada" seguem vivos).
      if (!mostrarConcluidos && resultadoTerminal(l.resultado)) return false;
      if (!q) return true;
      const nome = (l.nome ?? "").toLowerCase();
      const tel = l.telefone.replace(/\D/g, "");
      return nome.includes(q) || (qDigits.length >= 2 && tel.includes(qDigits));
    });
  }, [leads, busca, mostrarConcluidos]);

  const porColuna = useMemo(() => {
    const m = new Map<string, LeadRow[]>();
    for (const s of etapas) m.set(s.key, []);
    for (const l of filtrados) {
      m.get(colunaDe(l.funnel_stage))?.push(l);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const ta = a.ultima_interacao ? Date.parse(a.ultima_interacao) : -Infinity;
        const tb = b.ultima_interacao ? Date.parse(b.ultima_interacao) : -Infinity;
        return tb - ta;
      });
    }
    return m;
  }, [filtrados, etapas, chaves]);

  // O aviso só era limpo no início do próximo mover(): ficava pendurado no topo
  // muito depois de resolvido, sugerindo que o problema continuava.
  useEffect(() => {
    if (!erro) return;
    const t = setTimeout(() => setErro(null), 8000);
    return () => clearTimeout(t);
  }, [erro]);

  async function mover(telefone: string, novoStage: string) {
    const lead = leads.find((l) => l.telefone === telefone);
    // Bloqueio POR CARD: um POST em voo não pode engolir o movimento de outro.
    // Compara o estágio CRU (não a coluna exibida): um lead de etapa apagada
    // aparece na 1ª coluna, e movê-lo pra ela precisa GRAVAR de verdade.
    if (!lead || lead.funnel_stage === novoStage || movendo.has(telefone)) return;
    const anterior = lead.funnel_stage;
    setErro(null);
    setMovendo((prev) => new Set(prev).add(telefone));
    pendentes.current.set(telefone, novoStage);
    // Otimista: move já; reverte se o servidor recusar.
    setLeads((ls) =>
      ls.map((l) => (l.telefone === telefone ? { ...l, funnel_stage: novoStage } : l)),
    );
    try {
      const res = await fetch(`/api/lead/${encodeURIComponent(telefone)}/estagio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: novoStage }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setLeads((ls) =>
          ls.map((l) => (l.telefone === telefone ? { ...l, funnel_stage: anterior } : l)),
        );
        setErro({ telefone, msg: d.error ?? "Não consegui mover." });
      }
    } catch {
      setLeads((ls) =>
        ls.map((l) => (l.telefone === telefone ? { ...l, funnel_stage: anterior } : l)),
      );
      setErro({ telefone, msg: "Falha de rede — o card voltou." });
    } finally {
      pendentes.current.delete(telefone);
      setMovendo((prev) => {
        const n = new Set(prev);
        n.delete(telefone);
        return n;
      });
    }
  }

  // O CardErro já carregava o telefone e o render descartava: numa tela com
  // dezenas de cards, "Não consegui mover." não dizia de QUEM era — e o card
  // revertia numa coluna que podia estar fora do campo de visão.
  const leadDoErro = erro ? leads.find((l) => l.telefone === erro.telefone) : null;
  const rotuloErro = erro
    ? leadDoErro?.nome?.trim() || formatPhone(erro.telefone)
    : "";

  return (
    <div>
      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            aria-label="Buscar no funil"
            className="h-9 w-full rounded-lg border border-line bg-surface-2/60 pl-9 pr-3 text-[12.5px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setMostrarConcluidos((v) => !v)}
          aria-pressed={mostrarConcluidos}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium leading-none ring-1 ring-inset transition ${
            mostrarConcluidos
              ? "bg-brand/15 text-brand ring-brand/25"
              : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
          }`}
        >
          {mostrarConcluidos ? "Ocultar concluídos" : "Mostrar concluídos"}
        </button>
        <span className="ml-auto text-[11.5px] text-ink-faint">
          {/* A dica não pode prometer arrastar no celular: lá isso não funciona. */}
          <span className="hidden sm:inline">
            Arraste um card para mudar o estágio — ou use o seletor no próprio card.
          </span>
          <span className="sm:hidden">Use o seletor em cada card para mudar o estágio.</span>
        </span>
      </div>

      {erro && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-[12.5px] text-amber"
        >
          <strong className="font-semibold">{rotuloErro}</strong> — {erro.msg}
        </p>
      )}

      {/* Colunas */}
      <div className="scroll-slim -mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-4">
        {etapas.map((s) => {
          const itens = porColuna.get(s.key) ?? [];
          const aberta = expandidas.has(s.key);
          const visiveis = aberta ? itens : itens.slice(0, POR_COLUNA);
          const alvo = sobre === s.key;
          return (
            <section
              key={s.key}
              aria-label={`Coluna ${s.label}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (sobre !== s.key) setSobre(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const tel = e.dataTransfer.getData("text/plain");
                if (tel) void mover(tel, s.key);
              }}
              className={`card-surface w-[272px] shrink-0 rounded-2xl border shadow-card transition ${
                alvo ? "border-brand/50 bg-brand/[0.04]" : "border-line"
              }`}
            >
              <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <h3 className="text-[12.5px] font-semibold tracking-tight text-ink">{s.label}</h3>
                <span className="tnum ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {itens.length}
                </span>
              </header>

              <div className="scroll-slim flex max-h-[calc(100vh-330px)] min-h-[80px] flex-col gap-2 overflow-y-auto p-2.5">
                {visiveis.length === 0 && (
                  <p className="px-1 py-3 text-center text-[11.5px] text-ink-faint">
                    {alvo ? "Solte aqui" : "Vazio"}
                  </p>
                )}
                {visiveis.map((l) => (
                  <article
                    key={l.telefone}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.telefone);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={`group rounded-xl border border-line bg-surface-2/50 p-2.5 transition hover:border-line-strong ${
                      movendo.has(l.telefone)
                        ? "opacity-50"
                        : "cursor-grab active:cursor-grabbing"
                    } ${resultadoTerminal(l.resultado) ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ color: s.color, background: `${s.color}1f` }}
                      >
                        <Sigilo>{initials(l.nome)}</Sigilo>
                      </span>
                      <Link
                        href={`/leads/${encodeURIComponent(l.telefone)}`}
                        draggable={false}
                        className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink hover:text-brand"
                        title="Abrir o Lead 360"
                      >
                        <Sigilo>{l.nome?.trim() || formatPhone(l.telefone)}</Sigilo>
                      </Link>
                      <span className="shrink-0 text-[10.5px] text-ink-faint">
                        {relativeTime(l.ultima_interacao)}
                      </span>
                    </div>

                    <p className="mt-1 pl-8 font-mono text-[10.5px] text-ink-faint">
                      <Sigilo>{formatPhone(l.telefone)}</Sigilo>
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
                      {l.perfil && <PerfilBadge perfil={l.perfil} size="sm" />}
                      {(l.cidade || l.uf) && (
                        <span className="text-[10.5px] text-ink-muted">
                          {l.cidade ?? ""}
                          {l.uf ? ` · ${l.uf}` : ""}
                        </span>
                      )}
                      {l.resultado && <ResultadoBadge resultado={l.resultado} size="sm" />}
                    </div>

                    {/* No celular este seletor é o ÚNICO jeito de mover o lead:
                        o drag HTML5 não dispara com toque em navegador nenhum.
                        Por isso ele é largura cheia e 44px abaixo de `sm` —
                        antes tinha ~19px de altura e fonte de 10,5px, e errar
                        aqui move o lead de etapa de verdade (grava evento na
                        timeline e pode disparar a sequência da etapa). */}
                    <div className="mt-2 flex justify-end">
                      <select
                        value={colunaDe(l.funnel_stage)}
                        onChange={(e) => void mover(l.telefone, e.target.value)}
                        disabled={movendo.has(l.telefone)}
                        aria-label={`Mover ${l.nome ?? l.telefone} de estágio`}
                        className="h-11 w-full rounded-lg border border-line bg-transparent px-2 text-ink-muted outline-none transition hover:text-ink focus-visible:border-brand/60 disabled:opacity-50 sm:h-auto sm:w-auto sm:rounded-md sm:px-1.5 sm:py-0.5 sm:text-[10.5px] sm:text-ink-faint"
                      >
                        {etapas.map((o) => (
                          <option
                            key={o.key}
                            value={o.key}
                            style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}
                          >
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}

                {itens.length > POR_COLUNA && !aberta && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandidas((prev) => new Set(prev).add(s.key))
                    }
                    className="rounded-lg border border-line px-2 py-1.5 text-[11.5px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
                  >
                    Mostrar todos ({itens.length})
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
