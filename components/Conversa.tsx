"use client";

import { useEffect, useRef, useState } from "react";
import { ConversaMessage, LiveMessage } from "@/lib/types";
import { EmptyState } from "./EmptyState";

/**
 * Conversa completa (WhatsApp) entre o lead e o robô, AO VIVO. Mensagens do
 * bot (ai) à esquerda com o tom da marca; do cliente (human) à direita,
 * neutras. O conteúdo já chega limpo (sem tags de orquestração).
 *
 * Ao vivo: a cada 3s busca /api/conversa/[telefone]/messages?after=<cursor>
 * (id da última mensagem). Novas mensagens são deduplicadas por id, anexadas, o
 * cursor avança e a lista rola até o fim. O fetch é pulado quando a aba está
 * oculta (document.visibilityState === "hidden"), e respostas !ok são ignoradas
 * silenciosamente (a sessão pode ter expirado).
 */
export function Conversa({
  telefone,
  initialMessages,
  atendenteNome,
}: {
  telefone: string;
  initialMessages: ConversaMessage[];
  /** Nome do robô (Ajustes → painel_config.atendente_nome). Sem nome, "Robô". */
  atendenteNome?: string | null;
}) {
  const nomeBot = (atendenteNome ?? "").trim() || "Robô";
  const [messages, setMessages] = useState<ConversaMessage[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<number>(
    initialMessages.length ? initialMessages[initialMessages.length - 1].id : 0,
  );
  const seenRef = useRef<Set<number>>(new Set(initialMessages.map((m) => m.id)));

  // Rola até o fim sempre que chega mensagem nova (e no primeiro render).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const POLL_MS = 3000;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return; // não consome recursos com a aba em segundo plano
      }
      try {
        const res = await fetch(
          `/api/conversa/${encodeURIComponent(telefone)}/messages?after=${cursorRef.current}`,
          { cache: "no-store" },
        );
        if (!res.ok) return; // sessão expirada / erro transitório → ignora o tick
        const data = (await res.json()) as { messages?: LiveMessage[] };
        const incoming = data.messages ?? [];
        if (!incoming.length) return;

        const fresh = incoming.filter((m) => !seenRef.current.has(m.id));
        if (!fresh.length) return;
        for (const m of fresh) seenRef.current.add(m.id);
        cursorRef.current = Math.max(cursorRef.current, ...fresh.map((m) => m.id));

        setMessages((prev) => [
          ...prev,
          ...fresh.map((m) => ({
            id: m.id,
            role: m.autor === "ia" ? ("ai" as const) : ("human" as const),
            text: m.texto,
            origem: m.via
              ? m.via
              : m.autor === "ia"
                ? ("bot" as const)
                : null,
          })),
        ]);
      } catch {
        // hiccup de rede — pula este tick
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [telefone]);

  if (!messages.length) {
    return (
      <EmptyState
        title="Sem conversa registrada"
        hint="As mensagens trocadas com o robô aparecem aqui quando existirem."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Indicador "ao vivo" — cabeçalho da conversa */}
      <div className="mb-2.5 flex items-center justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-muted">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand animate-pulse-ring" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          ao vivo
        </span>
      </div>

      <div
        ref={scrollRef}
        className="scroll-slim -mr-2 max-h-[560px] space-y-3 overflow-y-auto pr-2"
      >
        {messages.map((m) => {
          const isAi = m.role === "ai";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
            >
              <span
                className={`mb-1 px-1 text-[10.5px] font-medium uppercase tracking-wider ${
                  isAi ? "text-brand/80" : "text-ink-faint"
                }`}
              >
                {!isAi
                  ? "Cliente"
                  : m.origem === "painel"
                    ? "Você"
                    : m.origem === "celular"
                      ? "Celular"
                      : nomeBot}
              </span>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  isAi
                    ? "rounded-tl-sm border border-brand/15 bg-brand/[0.07] text-ink"
                    : "rounded-tr-sm border border-line bg-surface-2/70 text-ink-muted"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
