"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConversaResumo } from "@/lib/types";
import { stageMeta, STAGE_ORDER } from "@/lib/theme";
import { initials, formatPhone, relativeTime, consultorCor } from "@/lib/format";
import { StageBadge } from "../StageBadge";
import { EmptyState } from "../EmptyState";
import { InboxChat } from "./InboxChat";
import { Sigilo } from "../Sigilo";

/**
 * Inbox de duas colunas (/conversas), com cara de WhatsApp. Esquerda: lista de
 * conversas com auto-refresh (~7s, pausa com a aba oculta), busca e filtros
 * (Todas / Aguardando). Direita: o chat ao vivo da conversa selecionada. No
 * desktop as duas colunas convivem; no mobile a seleção troca da lista para o
 * chat (com botão de voltar).
 *
 * `initialTel` (de /conversas?tel=) abre a conversa direto — é o que liga
 * Prioridades/Lead 360 ao "responder agora" sem refazer a busca.
 */
const soDigitos = (s: string) => s.replace(/\D/g, "");

export function InboxClient({
  initial,
  initialTel,
  consultor,
  etapas,
  admin = false,
}: {
  initial: ConversaResumo[];
  initialTel?: string;
  consultor?: string;
  /** Etapas dinâmicas do funil (funil_etapas) — filtro + seletor do chat. */
  etapas?: { key: string; label: string; color: string }[];
  /** Repassado ao chat: só admin vê o link de gerenciar atalhos (/config). */
  admin?: boolean;
}) {
  const listaEtapas = etapas?.length ? etapas : STAGE_ORDER;
  const [conversas, setConversas] = useState<ConversaResumo[]>(initial);
  const [selected, setSelected] = useState<string | null>(() => {
    const alvo = soDigitos(initialTel ?? "");
    if (!alvo) return null;
    // Casa por dígitos (o link pode vir formatado). Se a conversa estiver fora
    // da lista carregada (limite de 200 recentes), abre pelo número mesmo.
    const achou = initial.find((c) => soDigitos(c.telefone) === alvo);
    return achou ? achou.telefone : alvo;
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "aguardando">("todas");
  const [estagio, setEstagio] = useState("");

  /* Abrir/fechar conversa mexe no HISTÓRICO do navegador. Antes era só estado
     React: no celular, o botão físico de voltar (Android) e o gesto de borda
     (iOS) tiravam o consultor de /conversas INTEIRA em vez de devolvê-lo à
     lista — perdendo busca, filtro e posição de rolagem. Usamos a history API
     direto (suportada pelo App Router para mexer em searchParams) em vez de
     router.push, que faria o servidor renderizar a página de novo a cada
     conversa aberta. */
  const abrirConversa = useCallback((tel: string) => {
    setSelected(tel);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    // Em modo demonstração o telefone NÃO vai pra URL: a barra de endereço
    // aparece na gravação, e nenhum borrão da página alcança ela. O número
    // segue no state do histórico, então voltar/avançar continua funcionando.
    if (document.documentElement.hasAttribute("data-demo")) url.searchParams.delete("tel");
    else url.searchParams.set("tel", tel);
    // Espalha o state do Next: sobrescrevê-lo confunde o roteador no back/forward.
    window.history.pushState({ ...window.history.state, inboxTel: tel }, "", url);
  }, []);

  const fecharConversa = useCallback(() => {
    // Se fomos nós que empilhamos, volta pelo histórico — assim o botão de
    // voltar e a seta da tela ficam em sincronia em vez de brigarem.
    if (typeof window !== "undefined" && (window.history.state as { inboxTel?: string } | null)?.inboxTel) {
      window.history.back();
      return;
    }
    setSelected(null);
  }, []);

  useEffect(() => {
    const aoVoltar = (ev: PopStateEvent) => {
      // O state vem primeiro: em modo demonstração a URL não carrega o telefone.
      const st = ev.state as { inboxTel?: string } | null;
      const tel = st?.inboxTel ?? new URLSearchParams(window.location.search).get("tel");
      setSelected(tel || null);
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  // Poll da lista (~7s). Pausa com a aba oculta.
  useEffect(() => {
    const POLL_MS = 7000;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        // Leva o filtro de consultor: senão o poll desfaz a escolha do admin.
        const url = consultor
          ? `/api/conversas?consultor=${encodeURIComponent(consultor)}`
          : "/api/conversas";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; conversas?: ConversaResumo[] };
        if (data.ok && Array.isArray(data.conversas)) setConversas(data.conversas);
      } catch {
        // hiccup de rede — pula este tick
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [consultor]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    const qDigits = q.replace(/\D/g, "");
    return conversas.filter((c) => {
      const nome = (c.nome ?? "").toLowerCase();
      const telDigits = c.telefone.replace(/\D/g, "");
      const matchNome = nome.includes(q);
      const matchTel = qDigits.length >= 2 && telDigits.includes(qDigits);
      return matchNome || matchTel;
    });
  }, [conversas, busca]);

  const aguardando = conversas.filter((c) => c.aguardando).length;

  // Filtros de pílula (client-side), aplicados por cima da busca.
  const visible = useMemo(() => {
    let v = filtro === "aguardando" ? filtered.filter((c) => c.aguardando) : filtered;
    if (estagio) v = v.filter((c) => c.funnel_stage === estagio);
    return v;
  }, [filtered, filtro, estagio]);

  const selectedConv = useMemo(
    () => conversas.find((c) => c.telefone === selected) ?? null,
    [conversas, selected],
  );

  // Duas peças que precisam andar juntas:
  //  • `min-h-0` na cadeia inteira — sem isso um filho flex/grid não encolhe
  //    abaixo do próprio conteúdo;
  //  • `grid-rows-[minmax(0,1fr)]` — a linha do grid é `auto` por padrão, ou
  //    seja, dimensionada PELO CONTEÚDO. Com a lista de 166 conversas dentro, a
  //    linha esticava, o `h-full` dos cards virava "altura do conteúdo" e a
  //    página inteira passava a rolar. `1fr` prende a linha à altura disponível
  //    e o `minmax(0,…)` deixa ela encolher.
  // Sem min-h fixo: o card tem de poder encolher (teclado aberto, janela baixa).
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
      {/* Lista (esquerda) */}
      <aside className={`min-h-0 ${selected ? "hidden lg:block" : "block"}`}>
        <div className="card-surface flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line shadow-card">
          <div className="border-b border-line px-3 py-3">
            <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                Conversas
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand animate-pulse-ring" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                ao vivo
              </span>
            </div>

            {/* Busca (pílula estilo WhatsApp) */}
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="m20 20-3.2-3.2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone"
                aria-label="Buscar conversa por nome ou telefone" className="w-full rounded-full border border-line bg-surface-2/70 py-2 pl-10 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint transition focus:border-brand/40 focus:outline-none"
              />
            </div>

            {/* Filtros (client-side) */}
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFiltro("todas")}
                aria-pressed={filtro === "todas"}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium leading-none ring-1 ring-inset transition ${
                  filtro === "todas"
                    ? "bg-brand/15 text-brand ring-brand/25"
                    : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
                }`}
              >
                Todas
              </button>
              {/* A conta é sobre o recorte carregado aqui (conversas recentes,
                  teto de 200) — /atendimento usa o censo completo da base e por
                  isso mostra um número maior. Sem dizer isso, o consultor zerava
                  o "Aguardando" aqui, via gente esperando lá, e passava a não
                  confiar em nenhum dos dois. */}
              <button
                type="button"
                onClick={() => setFiltro("aguardando")}
                aria-pressed={filtro === "aguardando"}
                title="Aguardando resposta entre as conversas recentes carregadas aqui. O total da base fica em Atendimento."
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium leading-none ring-1 ring-inset transition ${
                  filtro === "aguardando"
                    ? "bg-brand/15 text-brand ring-brand/25"
                    : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
                }`}
              >
                Aguardando
                {aguardando > 0 && (
                  <span className="tnum inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand/20 px-1 text-[10.5px] font-semibold text-brand">
                    {aguardando}
                  </span>
                )}
              </button>

              {/* Filtro por estágio do funil (o dado já está no badge da lista) */}
              <select
                value={estagio}
                onChange={(e) => setEstagio(e.target.value)}
                aria-label="Filtrar por estágio"
                title="Filtrar por estágio do funil"
                className={`ml-auto max-w-[130px] rounded-full border-0 px-2.5 py-1 text-[11.5px] font-medium leading-none outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-brand/70 ${
                  estagio
                    ? "bg-brand/15 text-brand ring-brand/25"
                    : "bg-surface-2/60 text-ink-muted ring-line hover:text-ink"
                }`}
              >
                <option value="" style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}>
                  Estágio: todos
                </option>
                {listaEtapas.map((s) => (
                  <option
                    key={s.key}
                    value={s.key}
                    style={{ color: "var(--c-ink)", background: "var(--c-surface2)" }}
                  >
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="scroll-slim flex-1 overflow-y-auto">
            {!visible.length ? (
              <div className="p-4">
                <EmptyState
                  title={filtro === "aguardando" ? "Nada aguardando" : "Nenhuma conversa"}
                  hint={
                    busca
                      ? "Ajuste a busca para ver outras conversas."
                      : filtro === "aguardando"
                        ? "Ninguém esperando resposta agora. Tudo em dia."
                        : "As conversas do WhatsApp aparecem aqui assim que houver mensagens."
                  }
                />
              </div>
            ) : (
              <ul>
                {visible.map((c) => {
                  const meta = stageMeta(c.funnel_stage);
                  const active = c.telefone === selected;
                  const isOut = c.lastAutor === "ia";
                  return (
                    <li key={c.telefone}>
                      <button
                        type="button"
                        onClick={() => abrirConversa(c.telefone)}
                        className={`flex w-full items-center gap-3 border-b border-line/50 px-3 py-2.5 text-left transition ${
                          active ? "bg-brand/[0.06]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* Avatar (~44px) */}
                        <span
                          className="tag-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[13.5px] font-semibold"
                          style={{ "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties}
                        >
                          <Sigilo>{initials(c.nome)}</Sigilo>
                        </span>

                        <span className="min-w-0 flex-1">
                          {/* Linha 1: nome + horário */}
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-[13.5px] font-medium ${
                                active ? "text-brand" : "text-ink"
                              }`}
                            >
                              <Sigilo>{c.nome?.trim() || formatPhone(c.telefone)}</Sigilo>
                            </span>
                            <span
                              className={`tnum shrink-0 text-[10.5px] ${
                                c.aguardando ? "font-medium text-brand" : "text-ink-faint"
                              }`}
                              title={c.ultima_interacao ?? undefined}
                            >
                              {relativeTime(c.ultima_interacao)}
                            </span>
                          </span>

                          {/* Linha 2: prévia + estágio / badge de não-lido */}
                          <span className="mt-1 flex items-center gap-2">
                            <span
                              className={`min-w-0 flex-1 truncate text-[12px] ${
                                c.aguardando ? "font-medium text-ink-muted" : "text-ink-faint"
                              }`}
                            >
                              {isOut && (
                                <span
                                  className="mr-0.5 tracking-[-0.18em] text-ink-muted"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              )}
                              {isOut && c.consultorNome && (
                                <span className="text-ink-faint">{c.consultorNome}: </span>
                              )}
                              {c.lastPreview ?? "—"}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {c.aguardando && (
                                <span
                                  className="h-2 w-2 rounded-full bg-brand shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
                                  aria-label="Aguardando resposta"
                                />
                              )}
                              {c.consultorNome && (
                                <span
                                  className="rounded-full px-1.5 py-[3px] text-[10.5px] font-semibold leading-none"
                                  style={consultorCor(c.consultorNome)}
                                  title={`Número do consultor ${c.consultorNome}`}
                                >
                                  {c.consultorNome.split(" ")[0]}
                                </span>
                              )}
                              <StageBadge stage={c.funnel_stage} size="sm" etapas={listaEtapas} />
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* Chat (direita). Renderiza a partir de `selected` (não de selectedConv)
          para que um ?tel= de conversa fora da lista carregada também abra. */}
      <section className={`min-h-0 ${selected ? "block" : "hidden lg:block"}`}>
        {selected ? (
          <InboxChat
            key={selected}
            telefone={selected}
            nome={selectedConv?.nome ?? null}
            funnelStage={selectedConv?.funnel_stage ?? ""}
            aguardando={selectedConv?.aguardando === true}
            consultorNome={selectedConv?.consultorNome ?? null}
            etapas={listaEtapas}
            admin={admin}
            onBack={fecharConversa}
          />
        ) : (
          <div className="card-surface flex h-full min-h-0 items-center justify-center rounded-2xl border border-line shadow-card">
            <div className="flex max-w-sm flex-col items-center px-8 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand/[0.07] ring-1 ring-inset ring-brand/15">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                    stroke="#35B06E"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                Selecione uma conversa
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Escolha um contato à esquerda para ver o histórico e responder pelo WhatsApp.
              </p>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-3 py-1.5 text-[11px] text-ink-faint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="9"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Ao responder, o bot é pausado automaticamente.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
