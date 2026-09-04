"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Painel de conexão da instância do WhatsApp (Evolution). Mostra o estado ao
 * vivo (poll do /api/evolution/status) e, quando a instância cai, um botão para
 * gerar o QR code de re-pareamento (/api/evolution/connect). Assim que reconecta
 * (state = 'open'), o QR some sozinho. Tudo server-side/auth — a chave da
 * Evolution nunca chega ao cliente.
 */

type Estado = "open" | "connecting" | "close" | "unknown" | "erro" | "carregando";

interface Qr {
  base64?: string;
  code?: string;
  pairingCode?: string;
}

function normaliza(state: string | undefined): Estado {
  const s = (state || "").toLowerCase();
  if (s === "open") return "open";
  if (s === "connecting") return "connecting";
  if (s === "close" || s === "closed") return "close";
  return "unknown";
}

const META: Record<Estado, { label: string; sub: string; cor: string; ring: string; bg: string }> = {
  open: {
    label: "Conectado",
    sub: "WhatsApp pareado e recebendo mensagens normalmente.",
    cor: "text-brand",
    ring: "ring-brand/30",
    bg: "bg-brand/10",
  },
  connecting: {
    label: "Conectando…",
    sub: "A instância está tentando se conectar. Aguarde alguns segundos.",
    cor: "text-amber",
    ring: "ring-amber/30",
    bg: "bg-amber/10",
  },
  close: {
    label: "Desconectado",
    sub: "A instância caiu. Gere o QR e re-pareie o WhatsApp do número.",
    cor: "text-danger",
    ring: "ring-danger/30",
    bg: "bg-danger/10",
  },
  unknown: {
    label: "Estado desconhecido",
    sub: "Não consegui ler o estado agora. Tente atualizar.",
    cor: "text-ink-muted",
    ring: "ring-white/15",
    bg: "bg-white/[0.05]",
  },
  erro: {
    label: "Erro ao consultar",
    sub: "A Evolution não respondeu (verifique EVOLUTION_API_URL / chave).",
    cor: "text-danger",
    ring: "ring-danger/30",
    bg: "bg-danger/10",
  },
  carregando: {
    label: "Verificando…",
    sub: "Lendo o estado da conexão.",
    cor: "text-ink-muted",
    ring: "ring-white/15",
    bg: "bg-white/[0.05]",
  },
};

export function ConexaoWhatsApp({
  instancia,
  nome,
}: {
  instancia?: string;
  nome?: string;
} = {}) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [gerando, setGerando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const qrRef = useRef(false);
  qrRef.current = !!qr;

  const buscarStatus = useCallback(async () => {
    try {
      const url = instancia
        ? `/api/evolution/status?instancia=${encodeURIComponent(instancia)}`
        : "/api/evolution/status";
      const res = await fetch(url, { cache: "no-store", redirect: "manual" });
      if (res.type === "opaqueredirect" || res.status === 0 || res.status === 401) {
        setEstado("erro");
        setErroMsg("Sessão do painel expirou — recarregue a página e entre de novo.");
        return null;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setEstado("erro");
        setErroMsg(data.error ?? "Falha ao consultar a Evolution.");
        return null;
      }
      setErroMsg(null);
      const e = normaliza(data.state);
      setEstado(e);
      // reconectou → limpa o QR
      if (e === "open") setQr(null);
      return e;
    } catch {
      setEstado("erro");
      setErroMsg("Sem resposta da Evolution.");
      return null;
    }
  }, []);

  // Poll do estado. 3s enquanto o QR está aberto (detecta reconexão rápido), 6s no resto.
  useEffect(() => {
    void buscarStatus();
    let id: ReturnType<typeof setInterval>;
    const arm = () => {
      id = setInterval(
        () => {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
          void buscarStatus();
        },
        qrRef.current ? 3000 : 6000,
      );
    };
    arm();
    // re-arma quando o QR abre/fecha para ajustar o intervalo
    const rearm = setInterval(() => {
      clearInterval(id);
      arm();
    }, 12000);
    return () => {
      clearInterval(id);
      clearInterval(rearm);
    };
  }, [buscarStatus]);

  const gerarQr = useCallback(async () => {
    setGerando(true);
    setErroMsg(null);
    try {
      const res = await fetch("/api/evolution/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instancia }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        base64?: string;
        code?: string;
        pairingCode?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErroMsg(data.error ?? "Não foi possível iniciar a conexão.");
        return;
      }
      if (normaliza(data.state) === "open") {
        setEstado("open");
        setQr(null);
        return;
      }
      if (data.base64 || data.code || data.pairingCode) {
        setQr({ base64: data.base64, code: data.code, pairingCode: data.pairingCode });
      } else {
        setErroMsg("A Evolution não retornou o QR. Tente de novo em alguns segundos.");
      }
      void buscarStatus();
    } catch {
      setErroMsg("Falha de rede ao gerar o QR.");
    } finally {
      setGerando(false);
    }
  }, [buscarStatus]);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await buscarStatus();
    setAtualizando(false);
  }, [buscarStatus]);

  const m = META[estado] ?? META.unknown;

  return (
    <div className="mx-auto max-w-xl">
      <div className="card-surface grain-none rounded-2xl border border-line p-5 shadow-card sm:p-6">
        {/* Estado */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${m.bg} ${m.ring}`}
            >
              <span className={`relative flex h-2.5 w-2.5 ${m.cor}`} aria-hidden="true">
                {estado === "connecting" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                )}
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
              </span>
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">
                Conexão do WhatsApp{nome ? ` (${nome})` : ""}
              </p>
              <p className={`font-display text-[18px] font-semibold leading-tight ${m.cor}`}>
                {m.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={atualizar}
            disabled={atualizando}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
            title="Atualizar o estado agora"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              className={atualizando ? "animate-spin" : ""}
              aria-hidden="true"
            >
              <path
                d="M20 11a8 8 0 1 0-.5 3M20 4v5h-5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Atualizar
          </button>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
          {erroMsg ?? m.sub}
        </p>

        {/* Ação principal quando não está conectado */}
        {estado !== "open" && !qr && (
          <button
            type="button"
            onClick={() => void gerarQr()}
            disabled={gerando}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[13.5px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {gerando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/40 border-t-[#04140d]" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            Gerar QR para reconectar
          </button>
        )}

        {/* QR + instruções */}
        {qr && (
          <div className="mt-4 rounded-xl border border-line bg-base/40 p-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {qr.base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr.base64}
                  alt="QR code para conectar o WhatsApp"
                  className="h-52 w-52 shrink-0 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2/60 p-3 text-center text-[11.5px] text-ink-muted">
                  QR indisponível como imagem — use o código de pareamento ao lado.
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">Como reconectar:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-ink-muted">
                  <li>Abra o WhatsApp no celular {nome ? `do ${nome}` : "deste número"}.</li>
                  <li>Toque em ⋮ → <span className="text-ink">Aparelhos conectados</span>.</li>
                  <li>Toque em <span className="text-ink">Conectar um aparelho</span>.</li>
                  <li>Aponte a câmera para este QR.</li>
                </ol>
                {qr.pairingCode && (
                  <div className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wider text-ink-faint">
                      Ou código de pareamento
                    </p>
                    <p className="tnum mt-0.5 font-mono text-[16px] font-semibold tracking-widest text-ink">
                      {qr.pairingCode}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void gerarQr()}
                  disabled={gerando}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
                >
                  {gerando ? "Gerando…" : "Gerar novo QR"}
                </button>
                <p className="mt-2 text-[11px] text-ink-faint">
                  O QR expira em alguns segundos. Assim que reconectar, esta tela atualiza sozinha.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-ink-faint">
        Dica: mantenha o celular {nome ? `do ${nome}` : "deste número"} com internet e bateria. Se
        a conexão cair, o bot para de
        receber e responder — volte aqui e re-pareie pelo QR.
      </p>
    </div>
  );
}
