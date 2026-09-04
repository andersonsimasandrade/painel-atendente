"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { Consultores } from "@/components/Consultores";
import { Gatilhos } from "@/components/Gatilhos";
import { SecaoHorarioBot } from "@/components/HorarioBot";

/**
 * Página "Ajustes" do painel. Três seções empilhadas:
 *  1. Atendente — nome de plantão (opcional) + liga/desliga a assinatura.
 *  2. Consultores — nome, voz e telefone de cada número (só admin).
 *  3. Gatilhos — as frases que acordam o bot num contato novo.
 *  4. Respostas rápidas — atalhos do ⚡ do chat (criar / listar / excluir).
 *
 * Todas as rotas são same-origin e exigem a sessão (middleware + verifyToken).
 * Usamos `redirect: "manual"` para detectar sessão expirada (o middleware
 * redireciona → opaqueredirect) e mostrar um aviso em vez de quebrar.
 */

type Resposta = { id: string; titulo: string; corpo: string };

const DANGER = "var(--c-danger)";

// Sessão expirou? (redirect do middleware vira opaqueredirect; ou 401 direto da rota)
function sessaoExpirada(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0 || res.status === 401;
}

export function Ajustes() {
  const [sessaoExpirou, setSessaoExpirou] = useState(false);
  const marcarSessao = useCallback(() => setSessaoExpirou(true), []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {sessaoExpirou && <BannerSessao />}
      <SecaoAtendente onSessaoExpirou={marcarSessao} />
      <SecaoHorarioBot onSessaoExpirou={marcarSessao} />
      <Consultores onSessaoExpirou={marcarSessao} />
      <Gatilhos onSessaoExpirou={marcarSessao} />
      <SecaoRespostas onSessaoExpirou={marcarSessao} />
    </div>
  );
}

/* ─────────────────────────── aviso de sessão ─────────────────────────── */

function BannerSessao() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 animate-fade-up">
      <p className="flex items-center gap-2 text-[13px] font-medium text-amber">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Sua sessão expirou. Recarregue a página e entre de novo.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber/40 px-3 text-[12px] font-semibold text-amber transition hover:bg-amber/15"
      >
        Recarregar
      </button>
    </div>
  );
}

/* ───────────────────────────── atendente ────────────────────────────── */

function SecaoAtendente({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [nome, setNome] = useState("");
  const [assinar, setAssinar] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store", redirect: "manual" });
        if (sessaoExpirada(res)) {
          onSessaoExpirou();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          config?: { atendente_nome?: string | null; assinar?: boolean };
          error?: string;
        };
        if (!vivo) return;
        if (!res.ok || !data.ok) {
          setMsg({ tipo: "erro", texto: data.error ?? "Não consegui carregar a configuração." });
          return;
        }
        setNome(data.config?.atendente_nome ?? "");
        setAssinar(data.config?.assinar !== false);
      } catch {
        if (vivo) setMsg({ tipo: "erro", texto: "Falha de rede ao carregar." });
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onSessaoExpirou]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ atendente_nome: nome.trim(), assinar }),
      });
      if (sessaoExpirada(res)) {
        onSessaoExpirou();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ tipo: "erro", texto: data.error ?? "Não foi possível salvar." });
        return;
      }
      setMsg({ tipo: "ok", texto: "Pronto! Configuração salva." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de rede. Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  const nomeLimpo = nome.trim();
  const assinaDeVerdade = assinar && nomeLimpo.length > 0;

  return (
    <Panel
      title="Atendente"
      subtitle="Quem está no plantão e como suas mensagens são assinadas"
      delay={80}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        As mensagens que você enviar pelo painel vão assinadas — o cliente vê{" "}
        <span className="font-mono text-[12px] text-ink">*Nome:*&nbsp;mensagem</span>. Deixe em
        branco para assinar com o <strong className="font-semibold text-ink">consultor do
        número</strong> (o normal). Preencha só quando quiser que TODAS as respostas do painel
        saiam com outro nome — quem está cobrindo o plantão, por exemplo.
      </p>

      <form onSubmit={salvar} className="mt-4 space-y-4">
        {/* Nome */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="atendente-nome" className="text-[12.5px] font-medium text-ink">
              Nome do atendente
            </label>
            <span className="tnum text-[11px] text-ink-faint">{nome.length}/40</span>
          </div>
          <input
            id="atendente-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            disabled={carregando}
            placeholder={carregando ? "Carregando…" : "Ex.: Ana"}
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)] disabled:opacity-60"
          />
        </div>

        {/* Toggle assinar */}
        <label
          htmlFor="assinar-toggle"
          className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Assinar minhas mensagens com este nome
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
              Desligue se preferir enviar sem nenhuma assinatura.
            </span>
          </span>
          <button
            id="assinar-toggle"
            type="button"
            role="switch"
            aria-checked={assinar}
            onClick={() => setAssinar((v) => !v)}
            disabled={carregando}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60 ${
              assinar ? "bg-brand" : "bg-surface-3 ring-1 ring-inset ring-line-strong"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition ${
                assinar ? "translate-x-[22px] bg-[#04140d]" : "translate-x-[2px] bg-ink-muted"
              }`}
            />
          </button>
        </label>

        {/* Prévia */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Prévia</p>
          <div className="mt-1.5 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink ring-1 ring-inset ring-brand/20">
              {assinaDeVerdade && (
                <span className="font-semibold text-brand-bright">{nomeLimpo}: </span>
              )}
              Olá, tudo bem?
            </div>
          </div>
          {!assinaDeVerdade && (
            <p className="mt-1.5 text-[11.5px] text-ink-faint">
              {nomeLimpo.length === 0
                ? "Sem nome de plantão — cada mensagem assina com o consultor do número."
                : "Assinatura desligada — as mensagens vão sem o nome."}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={salvando || carregando}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Salvar
          </button>

          {msg && (
            <p
              className={`flex items-center gap-1.5 text-[12px] ${
                msg.tipo === "ok" ? "text-brand" : "text-amber"
              }`}
            >
              {msg.tipo === "ok" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 13 4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {msg.texto}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}

/* ────────────────────────── respostas rápidas ───────────────────────── */

function SecaoRespostas({ onSessaoExpirou }: { onSessaoExpirou: () => void }) {
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/respostas-rapidas", {
          cache: "no-store",
          redirect: "manual",
        });
        if (sessaoExpirada(res)) {
          onSessaoExpirou();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          respostas?: Resposta[];
          error?: string;
        };
        if (!vivo) return;
        if (!res.ok || !data.ok) {
          setErro(data.error ?? "Não consegui carregar os atalhos.");
          return;
        }
        setRespostas(Array.isArray(data.respostas) ? data.respostas : []);
      } catch {
        if (vivo) setErro("Falha de rede ao carregar os atalhos.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onSessaoExpirou]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const t = titulo.trim();
    const c = corpo.trim();
    if (!t || !c) return;

    setErro(null);
    setAdicionando(true);
    const tempId = `temp-${Date.now()}`;
    const otimista: Resposta = { id: tempId, titulo: t, corpo: c };
    setRespostas((prev) => [otimista, ...prev]);
    setTitulo("");
    setCorpo("");

    const rollback = () => {
      setRespostas((prev) => prev.filter((r) => r.id !== tempId));
      setTitulo(t);
      setCorpo(c);
    };

    try {
      const res = await fetch("/api/respostas-rapidas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({ titulo: t, corpo: c }),
      });
      if (sessaoExpirada(res)) {
        rollback();
        onSessaoExpirou();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        resposta?: Resposta;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.resposta) {
        rollback();
        setErro(data.error ?? "Não foi possível adicionar o atalho.");
        return;
      }
      const criada = data.resposta;
      setRespostas((prev) => prev.map((r) => (r.id === tempId ? criada : r)));
    } catch {
      rollback();
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setAdicionando(false);
    }
  }

  async function remover(id: string) {
    const idx = respostas.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const alvo = respostas[idx];
    if (!window.confirm(`Excluir o atalho "${alvo.titulo}"?`)) return;

    setErro(null);
    setRespostas((prev) => prev.filter((r) => r.id !== id));

    const restaurar = () =>
      setRespostas((prev) => {
        const copia = [...prev];
        copia.splice(Math.min(idx, copia.length), 0, alvo);
        return copia;
      });

    try {
      const res = await fetch(`/api/respostas-rapidas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        redirect: "manual",
      });
      if (sessaoExpirada(res)) {
        restaurar();
        onSessaoExpirou();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        restaurar();
        setErro(data.error ?? "Não foi possível excluir.");
      }
    } catch {
      restaurar();
      setErro("Falha de rede ao excluir.");
    }
  }

  const podeAdicionar = titulo.trim().length > 0 && corpo.trim().length > 0 && !adicionando;

  return (
    <Panel
      title="Respostas rápidas"
      subtitle="Atalhos do ⚡ do chat — clique num atalho pra inserir o texto e editar antes de enviar"
      delay={140}
    >
      {/* Formulário de criação */}
      <form onSubmit={adicionar} className="space-y-3">
        <div>
          <label htmlFor="atalho-titulo" className="text-[12.5px] font-medium text-ink">
            Título curto
          </label>
          <input
            id="atalho-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Saudação"
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base/70 px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
          />
        </div>
        <div>
          <label htmlFor="atalho-corpo" className="text-[12.5px] font-medium text-ink">
            Mensagem
          </label>
          <textarea
            id="atalho-corpo"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={3}
            placeholder="Ex.: Vim pelo anúncio e quero saber mais"
            className="scroll-slim mt-1.5 w-full resize-y rounded-lg border border-line bg-base/70 px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:shadow-[0_0_0_3px_rgba(53,176,110,0.12)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!podeAdicionar}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adicionando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Adicionar atalho
          </button>
          {erro && (
            <p className="flex items-center gap-1.5 text-[12px] text-amber">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 8v5m0 3h.01M12 3l9 16H3l9-16Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {erro}
            </p>
          )}
        </div>
      </form>

      {/* Lista */}
      <div className="mt-5 border-t border-line pt-4">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-ink-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink-muted" />
            Carregando atalhos…
          </div>
        ) : respostas.length === 0 ? (
          <EmptyState
            title="Nenhum atalho ainda"
            hint="Crie o primeiro acima — ele passa a aparecer no ⚡ do chat."
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        ) : (
          <ul className="space-y-2">
            {respostas.map((r) => {
              const salvandoTemp = r.id.startsWith("temp-");
              return (
                <li
                  key={r.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 transition hover:border-line-strong ${
                    salvandoTemp ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{r.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
                      {r.corpo}
                    </p>
                  </div>
                  {salvandoTemp ? (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink-muted" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void remover(r.id)}
                      aria-label={`Excluir atalho ${r.titulo}`}
                      title="Excluir"
                      className="shrink-0 rounded-lg border border-line p-2 text-ink-faint transition hover:border-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)]"
                      style={
                        {
                          "--danger": DANGER,
                          "--danger-bg": "color-mix(in srgb, var(--c-danger) 10%, transparent)",
                        } as React.CSSProperties
                      }
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7M10 11v6M14 11v6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
