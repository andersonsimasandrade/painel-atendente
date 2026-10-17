"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContatoIG, MensagemIG } from "@/lib/ig-dados";
import { formatDateTime } from "@/lib/format";

// Caixa de entrada do Instagram: lista, conversa, resposta do time, assumir/devolver ao robô e ligação com o WhatsApp.

const ROTULO_TIPO: Record<string, string> = {
  boas_vindas: "Boas-vindas ao comentário",
  aviso_fora: "Aviso fora do horário",
  lembrete: "Lembrete de 4 h",
};

function nomeDe(c: ContatoIG): string {
  return c.nome || (c.username ? `@${c.username}` : `Instagram ${c.ig_id.slice(-4)}`);
}

export function InstagramInbox({ inicial, idInicial }: { inicial: ContatoIG[]; idInicial?: string }) {
  const [contatos, setContatos] = useState<ContatoIG[]>(inicial);
  const [selecionado, setSelecionado] = useState<string | null>(idInicial ?? inicial[0]?.ig_id ?? null);
  const [contato, setContato] = useState<ContatoIG | null>(null);
  const [mensagens, setMensagens] = useState<MensagemIG[]>([]);
  const [texto, setTexto] = useState("");
  const [zap, setZap] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; msg: string } | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const carregarLista = useCallback(async () => {
    try {
      const r = await fetch("/api/instagram/contatos", { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; contatos?: ContatoIG[] };
      if (d.ok && d.contatos) setContatos(d.contatos);
    } catch {
      /* mantém a lista atual */
    }
  }, []);

  const carregarConversa = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/instagram/contatos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; contato?: ContatoIG; mensagens?: MensagemIG[] };
      if (d.ok) {
        setContato(d.contato ?? null);
        setMensagens(d.mensagens ?? []);
      }
    } catch {
      /* mantém */
    }
  }, []);

  useEffect(() => {
    if (selecionado) void carregarConversa(selecionado);
  }, [selecionado, carregarConversa]);

  useEffect(() => {
    const t = setInterval(() => {
      void carregarLista();
      if (selecionado) void carregarConversa(selecionado);
    }, 12000);
    return () => clearInterval(t);
  }, [selecionado, carregarLista, carregarConversa]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, selecionado]);

  async function chamar(url: string, corpo: Record<string, unknown>): Promise<boolean> {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; erro?: string };
      if (!r.ok || !d.ok) {
        setAviso({ tipo: "erro", msg: d.error ?? d.erro ?? "Não consegui concluir." });
        return false;
      }
      return true;
    } catch {
      setAviso({ tipo: "erro", msg: "Falha de rede." });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado || !texto.trim()) return;
    if (await chamar("/api/instagram/enviar", { id: selecionado, texto })) {
      setTexto("");
      setAviso({ tipo: "ok", msg: "Enviado. O robô fica pausado nesta conversa por 48 h." });
      await Promise.all([carregarConversa(selecionado), carregarLista()]);
    }
  }

  async function mudarEstado(estado: "humano" | "robo") {
    if (!selecionado) return;
    if (await chamar("/api/instagram/estado", { id: selecionado, estado })) {
      await Promise.all([carregarConversa(selecionado), carregarLista()]);
    }
  }

  async function ligar(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado || !zap.trim()) return;
    if (await chamar("/api/instagram/ligar", { id: selecionado, whatsapp: zap })) {
      setZap("");
      setAviso({ tipo: "ok", msg: "Ligado ao WhatsApp. O cadastro do lead agora mostra esta conversa." });
      await Promise.all([carregarConversa(selecionado), carregarLista()]);
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Lista */}
      <section className="card-surface min-h-0 overflow-hidden rounded-2xl border border-line shadow-card lg:col-span-4">
        <div className="border-b border-line px-4 py-3 text-[12px] font-medium uppercase tracking-wider text-ink-faint">
          {contatos.length} conversa{contatos.length === 1 ? "" : "s"}
        </div>
        <ul className="scroll-slim max-h-[34dvh] overflow-y-auto lg:max-h-[calc(100dvh-14rem)]">
          {contatos.length === 0 && (
            <li className="px-4 py-6 text-[13px] text-ink-faint">Ninguém escreveu pelo Instagram ainda.</li>
          )}
          {contatos.map((c) => (
            <li key={c.ig_id}>
              <button
                type="button"
                onClick={() => setSelecionado(c.ig_id)}
                className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left transition hover:bg-surface-2/50 ${
                  selecionado === c.ig_id ? "bg-surface-2/60" : ""
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{nomeDe(c)}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      c.estado === "humano" ? "bg-amber/20 text-amber" : "bg-brand/15 text-brand"
                    }`}
                  >
                    {c.estado === "humano" ? "Com você" : "Robô"}
                  </span>
                </span>
                <span className="truncate text-[12.5px] text-ink-muted">{c.ultimo?.texto ?? "—"}</span>
                <span className="flex items-center gap-2 text-[11px] text-ink-faint">
                  {formatDateTime(c.ultima_interacao)}
                  {c.telefone && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-brand">WhatsApp ligado</span>}
                  {c.origem === "comentario" && <span>veio de comentário</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Conversa */}
      <section className="card-surface flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line shadow-card lg:col-span-8">
        {!contato ? (
          <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-ink-faint">Escolha uma conversa à esquerda.</div>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink">{nomeDe(contato)}</div>
                <div className="text-[12px] text-ink-faint">
                  {contato.username ? (
                    <a className="hover:underline" href={`https://instagram.com/${contato.username}`} target="_blank" rel="noopener noreferrer">
                      @{contato.username}
                    </a>
                  ) : (
                    "sem @ ainda"
                  )}
                  {contato.estagio ? ` · ${contato.estagio}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {contato.telefone && (
                  <Link
                    href={`/leads/${encodeURIComponent(contato.telefone)}`}
                    className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50"
                  >
                    Abrir cadastro do WhatsApp
                  </Link>
                )}
                {contato.estado === "robo" ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void mudarEstado("humano")}
                    className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50 disabled:opacity-50"
                  >
                    Assumir conversa
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void mudarEstado("robo")}
                    className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-[#04140d] hover:bg-brand-bright disabled:opacity-50"
                  >
                    Devolver ao robô
                  </button>
                )}
              </div>
            </header>

            {contato.obs && (
              <div className="border-b border-line bg-surface-2/30 px-4 py-2 text-[12.5px] text-ink-muted">
                <strong className="text-ink">Resumo do robô:</strong> {contato.obs}
              </div>
            )}

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-2.5">
                {mensagens.map((m) => {
                  const dela = m.papel === "user";
                  return (
                    <div key={m.id} className={`flex ${dela ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                          dela
                            ? "bg-surface-2/70 text-ink"
                            : m.papel === "humano"
                              ? "bg-brand/90 text-[#04140d]"
                              : "border border-line bg-base/60 text-ink"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                        <div className={`mt-1 text-[10.5px] ${m.papel === "humano" ? "text-[#04140d]/70" : "text-ink-faint"}`}>
                          {dela ? "Paciente" : m.papel === "humano" ? "Você" : (m.tipo && ROTULO_TIPO[m.tipo]) || "Robô"} ·{" "}
                          {formatDateTime(m.criado_em)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={fim} />
              </div>
            </div>

            <div className="border-t border-line px-4 py-3">
              {aviso && (
                <p className={`mb-2 text-[12px] ${aviso.tipo === "erro" ? "text-amber" : "text-brand"}`}>{aviso.msg}</p>
              )}
              <form onSubmit={enviar} className="flex gap-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) void enviar(e);
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Responder pelo Instagram… (Enter envia · Shift+Enter quebra a linha)"
                  aria-label="Responder pelo Instagram"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-base/70 px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60"
                />
                <button
                  type="submit"
                  disabled={ocupado || !texto.trim()}
                  className="inline-flex h-10 items-center self-end rounded-lg bg-brand px-4 text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                O Instagram só deixa responder em até 24 h depois da última mensagem da pessoa. Ao enviar, o robô pausa por 48 h.
              </p>

              {!contato.telefone && (
                <form onSubmit={ligar} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="text-[12px] text-ink-muted">A pessoa passou o WhatsApp? Ligue as duas conversas:</span>
                  <input
                    value={zap}
                    onChange={(e) => setZap(e.target.value)}
                    inputMode="tel"
                    placeholder="48 99999-9999"
                    aria-label="WhatsApp da pessoa"
                    className="h-8 w-40 rounded-lg border border-line bg-base/70 px-2.5 text-[13px] text-ink outline-none focus:border-brand/60"
                  />
                  <button
                    type="submit"
                    disabled={ocupado || !zap.trim()}
                    className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-semibold text-ink hover:bg-surface-2/50 disabled:opacity-50"
                  >
                    Ligar ao WhatsApp
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
