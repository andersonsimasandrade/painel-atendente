"use client";

import { useEffect, useState } from "react";

/**
 * Pontinho de status da conexão do WhatsApp, exibido ao lado do link "Conexão"
 * no menu. Faz um poll leve (~25s) do /api/evolution/status para o operador
 * perceber, de qualquer tela, se a instância caiu (fica vermelho).
 */
export function ConexaoDot() {
  const [cor, setCor] = useState<string>("bg-ink-faint");
  const [titulo, setTitulo] = useState<string>("Verificando conexão…");

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        // redirect:'manual' — se a sessão expirou, o middleware redireciona pra
        // /login; captamos isso como estado NEUTRO (não como "WhatsApp caiu").
        const res = await fetch("/api/evolution/status", {
          cache: "no-store",
          redirect: "manual",
        });
        if (!vivo) return;
        if (res.type === "opaqueredirect" || res.status === 0 || res.status === 401) {
          setCor("bg-ink-faint");
          setTitulo("Sessão do painel expirou — recarregue a página");
          return;
        }
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; state?: string };
        if (!res.ok || !d.ok) {
          setCor("bg-ink-faint");
          setTitulo("Não consegui ler o estado da conexão");
          return;
        }
        const s = (d.state || "").toLowerCase();
        if (s === "open") {
          setCor("bg-brand");
          setTitulo("WhatsApp conectado");
        } else if (s === "connecting") {
          setCor("bg-amber");
          setTitulo("WhatsApp conectando…");
        } else if (s === "close" || s === "closed") {
          // vermelho SÓ para desconexão real da instância
          setCor("bg-danger");
          setTitulo("WhatsApp desconectado — abra Conexão para reconectar");
        } else {
          setCor("bg-ink-faint");
          setTitulo("Estado da conexão desconhecido");
        }
      } catch {
        // erro de rede — estado neutro, não alarme de bot caído
        if (vivo) {
          setCor("bg-ink-faint");
          setTitulo("Sem resposta ao verificar a conexão");
        }
      }
    };
    void ler();
    const id = setInterval(ler, 25000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  // Quando a instância CAI, o bot para de responder e ninguém percebe. O estado
  // era só cor, num ponto de 6px marcado aria-hidden, com a explicação presa no
  // `title` — que não abre no toque e não existe pra leitor de tela. Agora o
  // ponto tem nome acessível e, se estiver desconectado, ganha rótulo visível.
  const caiu = cor === "bg-danger";
  return (
    <>
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${cor}`}
        title={titulo}
        role="img"
        aria-label={titulo}
      />
      {caiu && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-danger">
          fora
        </span>
      )}
    </>
  );
}
