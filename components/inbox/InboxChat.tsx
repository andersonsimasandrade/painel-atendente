"use client";

import {
  ChangeEvent,
  CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { MATERIAIS } from "@/lib/materiais";
import { LiveMessage } from "@/lib/types";
import { stageMeta } from "@/lib/theme";
import { initials, formatPhone, consultorCor, formatDateTime } from "@/lib/format";
import { EmptyState } from "../EmptyState";
import { MarcarLida } from "../MarcarLida";
import { MudarEstagio } from "../MudarEstagio";
import { EditarNome } from "../EditarNome";
import { useAudioRecorder } from "./useAudioRecorder";
import { Sigilo } from "../Sigilo";

/**
 * Chat AO VIVO do inbox — visual estilo WhatsApp (tema escuro verde da marca):
 *  • CLIENTE (human) à ESQUERDA (bolha neutra, rabinho inferior-esquerdo);
 *    SAÍDA (ia) à DIREITA (bolha verde, rabinho inferior-direito).
 *  • TRÊS saídas distinguidas de forma discreta (WhatsApp não rotula remetente):
 *    bot (sem `via`) ganha o selo "IA"; painel (via === 'painel') ganha o
 *    marcador "Você"; celular (via === 'celular') ganha "Celular" + ícone de
 *    aparelho. As duas humanas levam o fio de âmbar no anel da bolha.
 *  • Bolhas agrupadas por remetente: só a última do grupo mostra o rabinho.
 *
 * IMPORTANTE: n8n_chat_histories NÃO tem timestamp por mensagem — por isso as
 * bolhas não exibem horário e não há separadores de data. Não inventamos tempo.
 *
 * Reusa o polling de 3s de GET /api/conversa/[telefone]/messages, carregando o
 * histórico completo com ?after=0 e avançando o cursor pelo id. Composer: Enter
 * envia, Shift+Enter quebra linha, bolha otimista e reconciliação por id.
 * O estado do toggle Assumir/Devolver é OTIMISTA (não lemos o Redis do bot).
 */

type ChatMsg = {
  key: string;
  id: number;
  autor: "ia" | "humano";
  texto: string;
  via?: "painel" | "celular";
  pending?: boolean;
  uncertain?: boolean; // enviado sem confirmação (resposta perdida)
  notRecorded?: boolean; // enviado, mas não gravado na memória do bot
  created_at?: string | null; // ISO; null nas mensagens antigas (sem hora)
};

const toChatMsg = (m: LiveMessage): ChatMsg => ({
  key: `msg-${m.id}`,
  id: m.id,
  autor: m.autor,
  texto: m.texto,
  created_at: m.created_at ?? null,
  ...(m.via === "painel" || m.via === "celular" ? { via: m.via } : {}),
});

// ── Hora / data (fuso de São Paulo) ────────────────────────────────────────
// created_at só existe nas mensagens novas (a partir da coluna); mensagens
// antigas ficam sem hora — não inventamos tempo.
const SP_TZ = "America/Sao_Paulo";
function fmtHora(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP_TZ });
}
function diaISO(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: SP_TZ });
}
function dayLabel(iso?: string | null): string {
  const dia = diaISO(iso);
  if (!dia) return "";
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: SP_TZ });
  const ontem = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: SP_TZ });
  if (dia === hoje) return "Hoje";
  if (dia === ontem) return "Ontem";
  return new Date(iso as string).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SP_TZ,
  });
}

// Chave de "lado/remetente" para agrupar bolhas consecutivas (WhatsApp).
const senderKey = (m?: ChatMsg | null): "in" | "painel" | "celular" | "bot" | null =>
  !m ? null : m.autor !== "ia" ? "in" : (m.via ?? "bot");

// Fundo texturizado do painel de mensagens (estilo WhatsApp), no tom da marca:
// base verde bem escura + doodles verdes em opacidade baixíssima, repetidos.
const DOODLE = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>" +
    "<g fill='none' stroke='#35B06E' stroke-opacity='0.05' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
    "<path d='M28 44h30a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H44l-10 9v-9h-6a8 8 0 0 1-8-8V52a8 8 0 0 1 8-8z'/>" +
    "<circle cx='176' cy='40' r='13'/><path d='M170 40l4 4 8-9'/>" +
    "<path d='M60 150v18M51 159h18'/>" +
    "<path d='M116 118l4 9 9 4-9 4-4 9-4-9-9-4 9-4z'/>" +
    "<circle cx='196' cy='150' r='7'/><path d='M150 196h26'/>" +
    "<path d='M30 210l5 5 10-11'/><circle cx='120' cy='210' r='5'/>" +
    "</g></svg>",
);

// A cor vem de --c-chat-bg (par por tema em globals.css). Era #0a0f0d fixo: no
// tema claro o consultor via um retângulo PRETO no meio de uma página branca,
// com bolha clara de um lado e escura do outro — parecia bug, não escolha. E é
// a tela que ele mais usa, quase sempre no celular.
const CHAT_BG_STYLE: CSSProperties = {
  backgroundColor: "var(--c-chat-bg)",
  backgroundImage:
    "radial-gradient(1000px 420px at 50% -10%, rgba(53,176,110,0.06), transparent 60%)," +
    `url("data:image/svg+xml,${DOODLE}")`,
  backgroundRepeat: "no-repeat, repeat",
};

function SparkleIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="6"
        y="2"
        width="12"
        height="20"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M11 18.5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Composer estilo WhatsApp: emoji · anexo · atalhos · áudio ──────────────

// Atalho (resposta rápida) vindo de GET /api/respostas-rapidas.
type QuickReply = { id: string | number; titulo: string; corpo: string };

// Resultado de um envio pelo painel (mesma semântica do handleSend):
//  ok        → servidor confirmou; bolha reconciliada pelo id real.
//  uncertain → rede caiu sem resposta; bolha marcada (NÃO reenviar/restaurar).
//  failed    → servidor respondeu erro; bolha removida (pode restaurar entrada).
type SendResult = "ok" | "uncertain" | "failed";

// Grade de emojis comuns (hardcoded — sem biblioteca externa).
const EMOJIS: readonly string[] = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","🙂","😉","😍","🥰","😘","😗","😎",
  "🤩","🥳","🤔","🤗","😴","😌","😢","😭","👍","👎","👏","🙌","🙏","👌","🤝","✌️",
  "🤙","💪","👋","🫶","🤲","👇","👉","✍️","❤️","🧡","💛","💚","💙","💜","🤍","💯",
  "✅","❌","⭐","🔥","🎉","🎊","🥂","🍾","☕","🍫","💐","🌟","✨","📌","📎","📞",
  "📱","💬","⏰","📅","💰","🛍️","💄","🚀",
];

// Guardas de tamanho no cliente. As funções serverless da Vercel rejeitam
// corpo > ~4,5 MB ANTES do handler rodar, então tudo precisa caber nisso:
//  - Imagens são reduzidas no cliente (downscaleImage) → sempre cabem.
//  - Originais de imagem: limite generoso só p/ não carregar arquivos absurdos.
//  - Não-imagens (PDF/doc): não dá p/ comprimir → ~2,8 MB (base64 ~3,7M chars,
//    sob o MAX_B64 4.000.000 do servidor).
//  - Áudio: espelha o MAX_B64 (4.000.000 chars) da rota /enviar-audio.
const MAX_IMAGE_BYTES = 25_000_000;
const MAX_DOC_BYTES = 2_800_000;
const MAX_AUDIO_B64 = 4_000_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Falha ao ler o áudio."));
    fr.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// Reduz uma imagem via canvas para caber sob o limite de corpo (~4,5 MB) da
// Vercel: tenta dimensões/qualidades decrescentes até o data URL ficar sob o
// teto. Retorna JPEG pequeno, ou null se não conseguir (o chamador então
// valida o arquivo bruto).
async function downscaleImage(
  file: File,
): Promise<{ dataUrl: string; type: string; name: string } | null> {
  const CEIL = 3_800_000; // ~2,8 MB decodificado — margem sob o limite da Vercel
  const img = await loadImage(file);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const attempts = [
    { max: 1600, q: 0.82 },
    { max: 1280, q: 0.75 },
    { max: 1024, q: 0.7 },
    { max: 800, q: 0.62 },
  ];
  for (const a of attempts) {
    const scale = Math.min(1, a.max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Canvas nasce transparente-preto e o JPEG descarta o alpha (viraria preto).
    // Pinta branco antes: foto opaca cobre 100% (sem efeito); PNG/figurinha com
    // transparência fica com fundo branco em vez de preto.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/jpeg", a.q);
    } catch {
      return null; // canvas "tainted" (não deve ocorrer com arquivo local)
    }
    if (dataUrl && dataUrl.length <= CEIL) {
      const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
      return { dataUrl, type: "image/jpeg", name: `${base}.jpg` };
    }
  }
  return null;
}

// Valor inicial do datetime-local do agendamento: amanhã às 09:00 (hora local).
function amanhaLocal(): string {
  const d = new Date(Date.now() + 86400000);
  d.setHours(9, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTimer(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function EmojiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 10h.01M15 10h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 14.5a4 4 0 0 0 7 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.7 7.6a1.5 1.5 0 0 1-2.1-2.1l7-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2L4.5 13.2c-.4.5 0 1.3.6 1.3H11l-1 8.5 8.5-11.2c.4-.5 0-1.3-.6-1.3H12l1-8.5z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12l16-8-6 16-3-6-7-2z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-base/40 border-t-base" />
  );
}

export function InboxChat({
  telefone,
  nome,
  funnelStage,
  aguardando = false,
  consultorNome = null,
  etapas,
  admin = false,
  onBack,
}: {
  telefone: string;
  nome: string | null;
  funnelStage: string;
  aguardando?: boolean;
  /** Consultor do NÚMERO que atende esta conversa (chip no cabeçalho). */
  consultorNome?: string | null;
  /** Etapas dinâmicas do funil (p/ o seletor de estágio do cabeçalho). */
  etapas?: { key: string; label: string; color: string }[];
  /** Só o admin abre /config — sem isto o painel de atalhos oferecia ao
   *  consultor um link que o middleware bloqueia. */
  admin?: boolean;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErro, setLoadErro] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErro, setSendErro] = useState<string | null>(null);
  const [sendAviso, setSendAviso] = useState<string | null>(null);

  // Controle bot/humano. `null` = ainda não sabemos.
  //
  // Isto já foi `useState(false)` — o selo abria sempre dizendo "bot ativo",
  // sem nunca perguntar. Numa conversa que o consultor tinha assumido dezessete
  // vezes pelo celular, a tela mostrava o bot no ar. Agora o estado vem do
  // Redis (via webhook), e enquanto não chega a tela admite que não sabe.
  const [assumido, setAssumido] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleErro, setToggleErro] = useState<string | null>(null);

  // Rolagem: botão flutuante "ir ao fim" + aviso de "novas" quando o usuário
  // subiu para ler o histórico.
  const [showJump, setShowJump] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);
  const seenRef = useRef<Set<number>>(new Set());
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);

  // Mensagens AGENDADAS desta conversa ("manda sexta às 9h") — o rascunho do
  // compositor vira um envio futuro; o cron do funil dispara na hora marcada.
  const [agendadas, setAgendadas] = useState<
    { id: number; texto: string; enviar_em: string; criado_por: string | null }[]
  >([]);
  const [showAgendar, setShowAgendar] = useState(false);
  const [quandoLocal, setQuandoLocal] = useState("");
  const [agendando, setAgendando] = useState(false);
  const [agendarErro, setAgendarErro] = useState<string | null>(null);
  const [verTodasAgendadas, setVerTodasAgendadas] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  async function recarregarAgendadas() {
    try {
      const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/agendadas`, {
        cache: "no-store",
      });
      const d = (await res.json()) as { ok?: boolean; agendadas?: typeof agendadas };
      if (d.ok && Array.isArray(d.agendadas)) setAgendadas(d.agendadas);
    } catch {
      /* sem lista — o chat segue normal */
    }
  }

  useEffect(() => {
    void recarregarAgendadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefone]);

  async function agendarMsg() {
    const texto = draft.trim();
    if (!texto || !quandoLocal || agendando) return;
    setAgendando(true);
    setAgendarErro(null);
    try {
      const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/agendadas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, quando: new Date(quandoLocal).toISOString() }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        agendadas?: typeof agendadas;
      };
      if (!res.ok || !d.ok) {
        setAgendarErro(d.error ?? "Não consegui agendar.");
        return;
      }
      setDraft("");
      setQuandoLocal("");
      setShowAgendar(false);
      if (Array.isArray(d.agendadas)) setAgendadas(d.agendadas);
    } catch {
      setAgendarErro("Falha de rede ao agendar.");
    } finally {
      setAgendando(false);
    }
  }

  async function cancelarAgendadaUi(id: number) {
    if (cancelandoId !== null) return;
    setCancelandoId(id);
    try {
      const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/agendadas`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        agendadas?: typeof agendadas;
      };
      if (d.ok && Array.isArray(d.agendadas)) setAgendadas(d.agendadas);
      else {
        if (d.error) setSendAviso(d.error);
        await recarregarAgendadas(); // ex.: já saiu pelo cron — tira da strip
      }
    } catch {
      setSendAviso("Falha de rede ao cancelar o agendamento.");
    } finally {
      setCancelandoId(null);
    }
  }

  const meta = stageMeta(funnelStage);
  const nomeLabel = nome?.trim() || "Lead sem nome";

  // Lê o estado real do bot ao abrir a conversa. A pausa não é só do painel:
  // ela também é ligada quando o consultor responde pelo WhatsApp do aparelho,
  // e nesse caso o painel não teria como saber sozinho.
  useEffect(() => {
    let vivo = true;
    setAssumido(null);
    (async () => {
      try {
        const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/bot`, {
          cache: "no-store",
          redirect: "manual",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          pausado?: boolean | null;
        };
        if (!vivo) return;
        // Só assume um valor quando a resposta é confiável; senão fica em
        // "não sei", que é honesto e visível.
        if (res.ok && data.ok && typeof data.pausado === "boolean") {
          setAssumido(data.pausado);
        }
      } catch {
        /* mantém null — a tela mostra "verificando…" */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [telefone]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Carrega o histórico completo (after=0) ao abrir a conversa.
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setLoadErro(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/conversa/${encodeURIComponent(telefone)}/messages?after=0`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Não foi possível carregar a conversa.");
        const data = (await res.json()) as { messages?: LiveMessage[] };
        if (cancelado) return;
        const msgs = (data.messages ?? []).map(toChatMsg);
        for (const m of msgs) seenRef.current.add(m.id);
        cursorRef.current = msgs.length ? msgs[msgs.length - 1].id : 0;
        setMessages(msgs);
      } catch (e) {
        if (!cancelado) {
          setLoadErro(e instanceof Error ? e.message : "Erro ao carregar a conversa.");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [telefone]);

  // Poll de 3s (delta por cursor). Pausa com a aba oculta.
  useEffect(() => {
    const POLL_MS = 3000;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const res = await fetch(
          `/api/conversa/${encodeURIComponent(telefone)}/messages?after=${cursorRef.current}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: LiveMessage[] };
        const incoming = data.messages ?? [];
        if (!incoming.length) return;
        const fresh = incoming.filter((m) => !seenRef.current.has(m.id));
        if (!fresh.length) return;
        for (const m of fresh) seenRef.current.add(m.id);
        cursorRef.current = Math.max(cursorRef.current, ...fresh.map((m) => m.id));
        setMessages((prev) => {
          // dedup: bolha otimista do painel (pending/uncertain) cujo texto casa
          // com uma msg via:'painel' recém-chegada é substituída — reconcilia a
          // "resposta perdida" que na verdade foi enviada, sem duplicar.
          const painelFresh = new Set(
            fresh.filter((m) => m.via === "painel").map((m) => m.texto),
          );
          const base = painelFresh.size
            ? prev.filter(
                (m) =>
                  !(
                    (m.pending || m.uncertain) &&
                    m.via === "painel" &&
                    painelFresh.has(m.texto)
                  ),
              )
            : prev;
          return [...base, ...fresh.map(toChatMsg)];
        });
      } catch {
        // hiccup de rede — pula este tick
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [telefone]);

  // Auto-rola SÓ quando o usuário já está perto do fim (ou acabou de enviar —
  // bolha otimista tem id negativo/pending). Se ele subiu para ler o histórico,
  // não puxa a tela: marca "novas" no botão flutuante.
  useEffect(() => {
    const last = messages[messages.length - 1];
    const own = !!last && (last.pending || last.id < 0);
    if (atBottomRef.current || own) {
      scrollToBottom();
      atBottomRef.current = true;
      setShowJump(false);
      setHasNew(false);
    } else if (messages.length > prevLenRef.current) {
      setHasNew(true);
    }
    prevLenRef.current = messages.length;
  }, [messages, loading, scrollToBottom]);

  // Observa a posição da rolagem para decidir auto-scroll x botão flutuante.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = dist < 120;
    atBottomRef.current = near;
    setShowJump(!near);
    if (near) setHasNew(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    scrollToBottom();
    atBottomRef.current = true;
    setShowJump(false);
    setHasNew(false);
  }, [scrollToBottom]);

  // Auto-resize do textarea.
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const texto = draft.trim();
    if (!texto || sending) return;
    setSendErro(null);
    setSendAviso(null);

    const tempId = -Date.now();
    const optimistic: ChatMsg = {
      key: `tmp-${tempId}`,
      id: tempId,
      autor: "ia",
      texto,
      via: "painel",
      pending: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    requestAnimationFrame(resizeTextarea);
    setSending(true);

    let res: Response;
    try {
      res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
        cache: "no-store",
      });
    } catch {
      // Resposta perdida (rede caiu). A mensagem PODE ter sido enviada — NÃO
      // devolvemos o texto (evita reenvio duplicado); marcamos a bolha como
      // incerta e o poll a reconcilia se a linha real chegar.
      setMessages((prev) =>
        prev.map((m) =>
          m.key === optimistic.key ? { ...m, pending: false, uncertain: true } : m,
        ),
      );
      setSendAviso("Sem confirmação de envio — verifique no WhatsApp antes de reenviar.");
      setSending(false);
      return;
    }

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      pausa?: boolean;
      persisted?: boolean;
      message?: { id?: number };
    };

    if (!res.ok || !data.ok) {
      // Falha real do servidor (recebemos resposta) → remove a bolha e devolve o texto.
      setMessages((prev) => prev.filter((m) => m.key !== optimistic.key));
      setDraft(texto);
      requestAnimationFrame(resizeTextarea);
      setSendErro(data.error || "Falha ao enviar a mensagem.");
      setSending(false);
      return;
    }

    // Sucesso. Enviar pelo painel pausa o bot → reflete "assumido".
    setAssumido(true);
    if (data.pausa === false) {
      setSendAviso(
        "Mensagem enviada, mas não confirmei a pausa do bot — ele pode responder junto. Use 'Assumir' para tentar de novo.",
      );
    }
    const notRecorded = data.persisted === false;
    const realId = data.message?.id;
    if (typeof realId === "number") {
      if (seenRef.current.has(realId)) {
        // o poll já trouxe a linha real → descarta a bolha otimista
        setMessages((prev) => prev.filter((m) => m.key !== optimistic.key));
      } else {
        // NÃO avança o cursor: o poll ainda precisa trazer linhas intermediárias
        // (ex.: msg do cliente) com id < realId. Só marca como visto p/ dedup.
        seenRef.current.add(realId);
        setMessages((prev) =>
          prev.map((m) =>
            m.key === optimistic.key ? { ...m, id: realId, pending: false, notRecorded } : m,
          ),
        );
      }
    } else {
      // Sem id (registro na memória falhou) → mantém a bolha marcada.
      setMessages((prev) =>
        prev.map((m) =>
          m.key === optimistic.key ? { ...m, pending: false, notRecorded: true } : m,
        ),
      );
    }
    setSending(false);
  }, [draft, sending, telefone, resizeTextarea]);

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    // Sem saber o estado, o clique ASSUME a conversa: calar o bot por engano
    // é recuperável; soltá-lo em cima de uma negociação humana, não.
    const action = assumido === true ? "resume" : "pause";
    const next = assumido !== true;
    setToggling(true);
    setToggleErro(null);
    setAssumido(next); // otimista
    try {
      const res = await fetch(`/api/conversa/${encodeURIComponent(telefone)}/pausa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao alterar o estado.");
    } catch (e) {
      setAssumido(!next); // reverte
      setToggleErro(e instanceof Error ? e.message : "Falha ao alterar o estado.");
    } finally {
      setToggling(false);
    }
  }, [assumido, toggling, telefone]);

  // ── Extras do composer (emoji · anexo · atalhos · áudio) ─────────────────
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showMateriais, setShowMateriais] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[] | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickErro, setQuickErro] = useState<string | null>(null);
  const [attach, setAttach] = useState<{
    dataUrl: string;
    name: string;
    size: number;
    type: string;
    isImage: boolean;
  } | null>(null);

  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const quickWrapRef = useRef<HTMLDivElement>(null);
  const materiaisWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  // Insere texto na posição do cursor do textarea (mantém o foco).
  const insertAtCaret = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el) {
        setDraft((d) => d + text);
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      setDraft((prev) => prev.slice(0, start) + text + prev.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
        resizeTextarea();
      });
    },
    [resizeTextarea],
  );

  const toggleEmoji = useCallback(() => {
    setShowQuick(false);
    setShowMateriais(false);
    setShowEmoji((v) => !v);
  }, []);

  const loadQuick = useCallback(async () => {
    if (quickLoading) return;
    setQuickLoading(true);
    setQuickErro(null);
    try {
      const res = await fetch("/api/respostas-rapidas", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        respostas?: QuickReply[];
      };
      if (!res.ok || !data.ok) throw new Error();
      setQuickReplies(data.respostas ?? []);
    } catch {
      setQuickErro("Não foi possível carregar. Toque para tentar de novo.");
    } finally {
      setQuickLoading(false);
    }
  }, [quickLoading]);

  const toggleQuick = useCallback(() => {
    setShowEmoji(false);
    setShowMateriais(false);
    const willOpen = !showQuick;
    setShowQuick(willOpen);
    if (willOpen && quickReplies === null && !quickLoading) void loadQuick();
  }, [showQuick, quickReplies, quickLoading, loadQuick]);

  // Fecha os popovers ao clicar fora ou apertar Esc. O de Materiais ficava de
  // FORA daqui (o ref existia e nunca era lido), então só fechava pelo próprio
  // botão — e no celular o toque de descarte caía em cima de "Catálogo", que
  // dispara o arquivo pro cliente.
  useEffect(() => {
    if (!showEmoji && !showQuick && !showMateriais) return;
    const fecharTodos = () => {
      setShowEmoji(false);
      setShowQuick(false);
      setShowMateriais(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        emojiWrapRef.current?.contains(t) ||
        quickWrapRef.current?.contains(t) ||
        materiaisWrapRef.current?.contains(t)
      ) {
        return;
      }
      fecharTodos();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharTodos();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showEmoji, showQuick, showMateriais]);

  // Helper compartilhado de envio (áudio/mídia). ESPELHA o handleSend:
  // bolha otimista via:'painel' + reconciliação pelo id real (sem avançar o
  // cursor — só marca seenRef p/ dedup), com os mesmos avisos de pausa/persist.
  const sendPainel = useCallback(
    async (marker: string, request: () => Promise<Response>): Promise<SendResult> => {
      setSendErro(null);
      setSendAviso(null);

      const tempId = -Date.now();
      const optimistic: ChatMsg = {
        key: `tmp-${tempId}`,
        id: tempId,
        autor: "ia",
        texto: marker,
        via: "painel",
        pending: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      let res: Response;
      try {
        res = await request();
      } catch {
        // Resposta perdida — pode ter sido enviada. NÃO restaura a entrada
        // (evita reenvio duplicado); marca a bolha como incerta e o poll a
        // reconcilia se a linha real chegar.
        setMessages((prev) =>
          prev.map((m) =>
            m.key === optimistic.key ? { ...m, pending: false, uncertain: true } : m,
          ),
        );
        setSendAviso("Sem confirmação de envio — verifique no WhatsApp antes de reenviar.");
        return "uncertain";
      }

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        pausa?: boolean;
        persisted?: boolean;
        message?: { id?: number; texto?: string };
      };

      if (!res.ok || !data.ok) {
        setMessages((prev) => prev.filter((m) => m.key !== optimistic.key));
        setSendErro(data.error || "Falha ao enviar.");
        return "failed";
      }

      // Sucesso. Enviar pelo painel pausa o bot → reflete "assumido".
      setAssumido(true);
      if (data.pausa === false) {
        setSendAviso(
          "Mensagem enviada, mas não confirmei a pausa do bot — ele pode responder junto. Use 'Assumir' para tentar de novo.",
        );
      }
      const notRecorded = data.persisted === false;
      const realId = data.message?.id;
      const realTexto = data.message?.texto ?? marker;
      if (typeof realId === "number") {
        if (seenRef.current.has(realId)) {
          // o poll já trouxe a linha real → descarta a bolha otimista
          setMessages((prev) => prev.filter((m) => m.key !== optimistic.key));
        } else {
          // NÃO avança o cursor: só marca como visto p/ dedup.
          seenRef.current.add(realId);
          setMessages((prev) =>
            prev.map((m) =>
              m.key === optimistic.key
                ? { ...m, id: realId, texto: realTexto, pending: false, notRecorded }
                : m,
            ),
          );
        }
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === optimistic.key
              ? { ...m, texto: realTexto, pending: false, notRecorded: true }
              : m,
          ),
        );
      }
      return "ok";
    },
    [],
  );

  // Anexo escolhido: imagens são reduzidas no cliente (p/ caber no limite da
  // Vercel); PDFs/docs seguem crus mas com teto de tamanho. Depois mostra o
  // preview (com legenda no draft).
  const onFilePicked = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setSendErro(null);
    const isImage = file.type.startsWith("image/");

    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        setSendErro("Imagem muito grande (máx. 25 MB).");
        return;
      }
      const small = await downscaleImage(file);
      if (small) {
        setAttach({
          dataUrl: small.dataUrl,
          name: small.name,
          size: Math.round((small.dataUrl.length * 3) / 4), // ~tamanho do JPEG
          type: small.type,
          isImage: true,
        });
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      // não conseguiu reduzir — cai no fluxo cru, mas exige tamanho pequeno
      if (file.size > MAX_DOC_BYTES) {
        setSendErro("Não consegui reduzir a imagem. Envie uma menor (~3 MB).");
        return;
      }
    } else if (file.size > MAX_DOC_BYTES) {
      setSendErro("Arquivo muito grande (máx. ~3 MB). Comprima o PDF e tente de novo.");
      return;
    }

    const fr = new FileReader();
    fr.onload = () => {
      setAttach({
        dataUrl: String(fr.result),
        name: file.name,
        size: file.size,
        type: file.type || (isImage ? "image/*" : "application/octet-stream"),
        isImage,
      });
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    fr.onerror = () => setSendErro("Não foi possível ler o arquivo.");
    fr.readAsDataURL(file);
  }, []);

  const handleSendMedia = useCallback(async () => {
    if (!attach || sending) return;
    const caption = draft.trim();
    const snapshot = attach; // p/ restaurar em falha real do servidor
    const mediatype = attach.isImage ? "image" : "document";
    // Marcador espelhando a rota /enviar-midia (p/ dedup do poll casar o texto).
    const base = attach.isImage ? "🖼️ Imagem" : `📎 ${attach.name || "Arquivo"}`;
    const marker = caption ? `${base} — ${caption}` : base;

    setAttach(null);
    setDraft("");
    setShowEmoji(false);
    setShowQuick(false);
    requestAnimationFrame(resizeTextarea);
    setSending(true);
    const result = await sendPainel(marker, () =>
      fetch(`/api/conversa/${encodeURIComponent(telefone)}/enviar-midia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media: snapshot.dataUrl,
          mediatype,
          mimetype: snapshot.type,
          fileName: snapshot.name,
          caption,
        }),
        cache: "no-store",
      }),
    );
    if (result === "failed") {
      // servidor recusou (recebemos resposta) → devolve o anexo p/ retry
      setAttach(snapshot);
      setDraft(caption);
      requestAnimationFrame(resizeTextarea);
    }
    setSending(false);
  }, [attach, draft, sending, telefone, resizeTextarea, sendPainel]);

  // Envia um material pronto (catálogo/política) por URL — sem upload. Usa o
  // mesmo caminho otimista do resto do composer.
  const handleSendMaterial = useCallback(
    async (m: (typeof MATERIAIS)[number]) => {
      if (sending) return;
      setShowMateriais(false);
      setSending(true);
      await sendPainel(`📎 ${m.fileName}`, () =>
        fetch(`/api/conversa/${encodeURIComponent(telefone)}/enviar-midia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media: m.url,
            mediatype: "document",
            mimetype: "application/pdf",
            fileName: m.fileName,
          }),
          cache: "no-store",
        }),
      );
      setSending(false);
    },
    [sending, telefone, sendPainel],
  );

  const handleMicStart = useCallback(async () => {
    if (sending || loading) return;
    setSendErro(null);
    setSendAviso(null);
    setShowEmoji(false);
    setShowQuick(false);
    await recorder.start();
  }, [sending, loading, recorder]);

  const handleSendAudio = useCallback(async () => {
    if (sending) return;
    const blob = await recorder.stop();
    if (!blob) return;
    setSending(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl.length > MAX_AUDIO_B64) {
        setSendErro("Áudio muito longo — grave uma nota mais curta.");
        return;
      }
      await sendPainel("🎤 Áudio", () =>
        fetch(`/api/conversa/${encodeURIComponent(telefone)}/enviar-audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: dataUrl }),
          cache: "no-store",
        }),
      );
    } catch {
      setSendErro("Não foi possível processar o áudio.");
    } finally {
      setSending(false);
    }
  }, [sending, telefone, recorder, sendPainel]);

  const hasContent = !!draft.trim() || !!attach;

  return (
    <div className="card-surface flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line shadow-card">
      {/* Cabeçalho da conversa (estilo WhatsApp) */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 text-ink-muted transition hover:bg-white/[0.05] hover:text-ink lg:hidden"
            aria-label="Voltar para a lista"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <span
          className="tag-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-semibold"
          style={{ "--tag": meta.color, background: `${meta.color}1f` } as React.CSSProperties}
        >
          <Sigilo>{initials(nome)}</Sigilo>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
            <Sigilo><EditarNome telefone={telefone} nome={nome} /></Sigilo>
          </h2>
          {/* `truncate` no CONTAINER flex não corta nada: item flex tem
              min-width auto e não encolhe abaixo do próprio conteúdo. O telefone
              precisa de min-w-0 pra poder encolher com reticências — antes ele
              (e o chip do consultor) eram cortados pelo overflow-hidden do card,
              sem nenhum indício de que havia sido cortado. */}
          <p className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                assumido === null ? "bg-ink-faint" : assumido ? "bg-amber" : "bg-brand"
              }`}
              aria-hidden="true"
            />
            <span
              className={`shrink-0 ${
                assumido === null ? "text-ink-faint" : assumido ? "text-amber" : "text-brand"
              }`}
            >
              {assumido === null ? "verificando…" : assumido ? "humano assumiu" : "bot ativo"}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="min-w-0 truncate font-mono text-ink-muted">
              <Sigilo>{formatPhone(telefone)}</Sigilo>
            </span>
            {consultorNome && (
              <>
                <span className="text-ink-faint">·</span>
                <span
                  className="shrink-0 rounded-full px-1.5 py-[2px] text-[10px] font-semibold leading-none"
                  style={consultorCor(consultorNome)}
                  title="Consultor do número que atende esta conversa"
                >
                  {consultorNome}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand animate-pulse-ring" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            ao vivo
          </span>
          <MarcarLida telefone={telefone} aguardando={aguardando} />
          {/* Visível TAMBÉM no celular: era `hidden sm:inline-flex`, então em
              retrato o consultor não conseguia avançar a etapa logo depois de
              falar com o lead — tinha de abrir o Lead 360 e voltar. É a hora em
              que a informação está fresca; na prática o funil parava de ser
              atualizado nos atendimentos feitos em rua. */}
          <MudarEstagio telefone={telefone} stageAtual={funnelStage} compacto etapas={etapas} />
          <button
            type="button"
            onClick={() => {
              // Mesma assimetria do handleToggle: assumir é recuperável,
              // devolver não — o bot volta a falar por cima da negociação e a
              // mensagem já saiu pro cliente. Só o sentido "devolver" confirma.
              if (
                assumido === true &&
                !window.confirm(
                  `Devolver a conversa com ${nomeLabel} ao bot?\n\n` +
                    "Ele volta a responder sozinho a partir da próxima mensagem do lead.",
                )
              ) {
                return;
              }
              void handleToggle();
            }}
            disabled={toggling}
            aria-pressed={assumido === true}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium leading-none ring-1 ring-inset transition disabled:opacity-60 ${
              assumido === true
                ? "bg-amber/10 text-amber ring-amber/25 hover:bg-amber/15"
                : "bg-brand/10 text-brand ring-brand/25 hover:bg-brand/15"
            }`}
            title={
              assumido === true
                ? "Devolver a conversa ao bot (ele volta a responder)"
                : "Assumir a conversa (o bot fica em silêncio por 24h)"
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {assumido === true ? "Devolver" : "Assumir"}
          </button>
          <Link
            href={`/leads/${encodeURIComponent(telefone)}`}
            className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
            title="Abrir o Lead 360"
          >
            Lead 360
          </Link>
        </div>
        {toggleErro && <p className="w-full text-[11.5px] text-amber">{toggleErro}</p>}
      </header>

      {/* Corpo — mensagens sobre fundo texturizado (estilo WhatsApp) */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={CHAT_BG_STYLE}
          className="scroll-slim absolute inset-0 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-base/40 px-3 py-1.5 text-[12.5px] text-ink-muted backdrop-blur-sm">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Carregando conversa…
              </span>
            </div>
          ) : loadErro ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="rounded-lg bg-base/40 px-3 py-2 text-[12.5px] text-amber backdrop-blur-sm">
                {loadErro}
              </p>
            </div>
          ) : !messages.length ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                title="Sem conversa registrada"
                hint="As mensagens trocadas no WhatsApp aparecem aqui quando existirem."
              />
            </div>
          ) : (
            <>
              {/* n8n_chat_histories não tem timestamp por mensagem: sem horário
                  nas bolhas e sem separadores de data. */}
              {messages.map((m, i) => {
                const outbound = m.autor === "ia";
                // Origem humana da saída: 'painel' (digitou aqui) ou 'celular'
                // (mandou pelo WhatsApp do aparelho). undefined = bot.
                const humano = outbound ? m.via : undefined;
                const skey = senderKey(m);
                const firstInGroup = senderKey(messages[i - 1]) !== skey;
                const isTail = senderKey(messages[i + 1]) !== skey; // última do grupo

                // Cores da bolha + rabinho (mesmo tom da bolha).
                const tailBg = !outbound ? "bg-surface-3" : "bg-brand/[0.16]";
                const bubbleTone = !outbound
                  ? "bg-surface-3 text-ink ring-1 ring-inset ring-line"
                  : humano
                    ? "bg-brand/[0.16] text-[var(--c-chat-out-ink)] ring-1 ring-inset ring-amber/25"
                    : "bg-brand/[0.16] text-[var(--c-chat-out-ink)] ring-1 ring-inset ring-brand/20";

                // Cantos arredondados grandes; canto do rabinho menor (WhatsApp).
                const corners = !outbound
                  ? `rounded-2xl ${firstInGroup ? "" : "rounded-tl-md"} ${
                      isTail ? "rounded-bl-md" : "rounded-bl-2xl"
                    }`
                  : `rounded-2xl ${firstInGroup ? "" : "rounded-tr-md"} ${
                      isTail ? "rounded-br-md" : "rounded-br-2xl"
                    }`;

                const hora = fmtHora(m.created_at);
                const sepLabel =
                  dayLabel(m.created_at) &&
                  diaISO(m.created_at) !== diaISO(messages[i - 1]?.created_at)
                    ? dayLabel(m.created_at)
                    : "";

                return (
                  <Fragment key={m.key}>
                    {sepLabel && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-base/55 px-2.5 py-1 text-[10.5px] font-medium text-ink-muted ring-1 ring-inset ring-line-strong backdrop-blur-sm">
                          {sepLabel}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${outbound ? "justify-end" : "justify-start"} ${
                        firstInGroup ? "mt-3 first:mt-0" : "mt-1"
                      } ${m.pending ? "opacity-70" : ""}`}
                    >
                    <div
                      className={`relative max-w-[82%] px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:max-w-[76%] ${corners} ${bubbleTone}`}
                    >
                      {/* Rabinho — só na última bolha do grupo */}
                      {isTail &&
                        (outbound ? (
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-0 right-[-8px] h-[14px] w-[8px] ${tailBg} [clip-path:polygon(0_0,0_100%,100%_100%)]`}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-0 left-[-8px] h-[14px] w-[8px] ${tailBg} [clip-path:polygon(100%_0,100%_100%,0_100%)]`}
                          />
                        ))}

                      <div className="sigilo-msg whitespace-pre-wrap break-words text-[13.5px] leading-[1.45]">
                        {m.texto}
                      </div>

                      {!outbound && hora && (
                        <div className="mt-0.5 text-right text-[11px] font-medium leading-none text-ink-muted">
                          {hora}
                        </div>
                      )}

                      {/* Meta de saída: marcador + hora + status (bottom-right) */}
                      {outbound && (
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium leading-none">
                          {humano === "painel" ? (
                            <span className="text-amber/75">Você</span>
                          ) : humano === "celular" ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-amber/75"
                              title="Enviada pelo consultor no WhatsApp do aparelho"
                            >
                              <PhoneIcon />
                              Celular
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-brand/80">
                              <SparkleIcon />
                              IA
                            </span>
                          )}
                          {hora && <span className="font-normal text-ink-muted">{hora}</span>}
                          {m.pending ? (
                            <span className="text-ink-faint" title="enviando">
                              <ClockIcon />
                            </span>
                          ) : m.uncertain ? (
                            <span className="text-[11px] font-bold text-amber" title="sem confirmação">
                              !
                            </span>
                          ) : m.notRecorded ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-amber"
                              title="enviada · não registrada"
                              aria-label="enviada, não registrada"
                            />
                          ) : (
                            /* "enviada", não "entregue": não temos recibo de
                               entrega do WhatsApp — só sabemos que saiu daqui. */
                            <span
                              className="tracking-[-0.18em] text-ink-muted"
                              title="enviada (sem confirmação de entrega)"
                              aria-label="enviada"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </>
          )}
        </div>

        {/* Botão flutuante: ir ao fim (+ aviso de novas mensagens) */}
        {showJump && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full sm:h-9 sm:w-9 border border-line-strong bg-surface-2 text-ink-muted shadow-card transition hover:text-ink"
            aria-label="Ir para a mensagem mais recente"
            title="Ir para a última mensagem"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {hasNew && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border-2 border-surface-2 bg-brand px-1 text-[8px] font-bold text-base"
                aria-label="novas mensagens"
              >
                •
              </span>
            )}
          </button>
        )}
      </div>

      {/* Composer (estilo WhatsApp) */}
      <div className="border-t border-line px-3 py-2.5 sm:px-4">
        {sendErro && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber/25 bg-amber/[0.08] px-2.5 py-1.5 text-[11.5px] text-amber">
            <span>{sendErro}</span>
            <button
              type="button"
              onClick={() => setSendErro(null)}
              className="shrink-0 text-amber/80 transition hover:text-amber"
              aria-label="Dispensar erro"
            >
              ✕
            </button>
          </div>
        )}
        {sendAviso && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-amber/25 bg-amber/[0.08] px-2.5 py-1.5 text-[11.5px] text-amber">
            <span>{sendAviso}</span>
            <button
              type="button"
              onClick={() => setSendAviso(null)}
              className="shrink-0 text-amber/80 transition hover:text-amber"
              aria-label="Dispensar aviso"
            >
              ✕
            </button>
          </div>
        )}
        {/* Erro/permissão do microfone (áudio) */}
        {recorder.error && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber/25 bg-amber/[0.08] px-2.5 py-1.5 text-[11.5px] text-amber">
            <span>{recorder.error}</span>
            <button
              type="button"
              onClick={recorder.clearError}
              className="shrink-0 text-amber/80 transition hover:text-amber"
              aria-label="Dispensar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mensagens agendadas pendentes desta conversa */}
        {agendadas.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {agendadas.slice(0, verTodasAgendadas ? agendadas.length : 3).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-[11.5px] text-ink-muted"
              >
                <span className="min-w-0 truncate">
                  ⏰ <span className="font-medium text-ink">{formatDateTime(a.enviar_em)}</span>
                  {" — "}
                  {a.texto}
                </span>
                <button
                  type="button"
                  onClick={() => void cancelarAgendadaUi(a.id)}
                  disabled={cancelandoId === a.id}
                  className="shrink-0 text-ink-faint transition hover:text-red-300 disabled:opacity-50"
                  aria-label="Cancelar mensagem agendada"
                  title="Cancelar este agendamento"
                >
                  ✕
                </button>
              </div>
            ))}
            {agendadas.length > 3 && (
              <button
                type="button"
                onClick={() => setVerTodasAgendadas((v) => !v)}
                className="self-start px-1 text-[10.5px] text-ink-faint transition hover:text-ink"
              >
                {verTodasAgendadas
                  ? "mostrar menos"
                  : `+${agendadas.length - 3} mensagens agendadas — ver todas`}
              </button>
            )}
          </div>
        )}

        {/* Preview do anexo (imagem ou documento) — legenda vai no textarea */}
        {attach && !recorder.recording && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/70 p-2">
            {attach.isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attach.dataUrl}
                alt={attach.name}
                className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-line"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                <FileIcon />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">{attach.name}</p>
              <p className="text-[11px] text-ink-muted">
                {attach.isImage ? "Imagem" : "Documento"} · {formatBytes(attach.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAttach(null)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-white/[0.05] hover:text-ink"
              aria-label="Remover anexo"
              title="Remover anexo"
            >
              ✕
            </button>
          </div>
        )}

        {recorder.recording ? (
          /* Barra de gravação (substitui a linha do composer) */
          <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface-2/70 py-2 pl-4 pr-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/70 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[13px] tabular-nums text-ink">
              {fmtTimer(recorder.seconds)}
            </span>
            <span className="text-[12px] text-ink-muted">Gravando áudio…</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => recorder.cancel()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition hover:bg-white/[0.05] hover:text-amber"
                aria-label="Cancelar gravação"
                title="Cancelar"
              >
                <TrashIcon />
              </button>
              <button
                type="button"
                onClick={() => void handleSendAudio()}
                disabled={sending}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-[#06160f] shadow-[0_2px_12px_-2px_rgba(53,176,110,0.55)] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar áudio"
                title="Enviar áudio"
              >
                {sending ? <Spinner /> : <SendIcon />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* No celular a pílula QUEBRA em duas linhas: o campo de texto ocupa
                a largura toda em cima e os quatro ícones ficam embaixo. Em uma
                linha só (como era) sobravam ~55px pro campo num iPhone de 375px
                — o consultor digitava vendo seis caracteres. De `sm` pra cima
                volta a ser uma linha, igual antes. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-0.5 rounded-3xl border border-line bg-surface-2/70 py-1 pl-1.5 pr-2.5 transition focus-within:border-brand/40 sm:flex-nowrap">
              {/* Emoji (funcional) */}
              <div ref={emojiWrapRef} className="relative shrink-0">
                {showEmoji && (
                  <div
                    role="dialog"
                    aria-label="Emojis"
                    className="absolute bottom-full left-0 z-20 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-elevated/95 p-2 shadow-card backdrop-blur-md"
                  >
                    <div className="scroll-slim grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => insertAtCaret(e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] leading-none transition hover:bg-white/[0.06]"
                          aria-label={`Inserir ${e}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleEmoji}
                  aria-expanded={showEmoji}
                  aria-label="Emojis"
                  title="Emojis"
                  className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-9 sm:w-9 transition hover:bg-white/[0.05] ${
                    showEmoji ? "text-brand" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <EmojiIcon />
                </button>
              </div>

              {/* Anexar (imagem/documento) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Anexar imagem ou documento"
                title="Anexar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 text-ink-faint transition hover:bg-white/[0.05] hover:text-ink-muted disabled:opacity-50"
              >
                <PaperclipIcon />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={onFilePicked}
                className="hidden"
              />

              {/* Materiais prontos (catálogo / política) — 1 clique, sem upload */}
              <div ref={materiaisWrapRef} className="relative shrink-0">
                {showMateriais && (
                  <div
                    role="dialog"
                    aria-label="Materiais"
                    className="absolute bottom-11 left-0 z-20 w-56 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card"
                  >
                    <p className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                      Materiais
                    </p>
                    <ul className="py-1">
                      {MATERIAIS.map((m) => (
                        <li key={m.url}>
                          <button
                            type="button"
                            onClick={() => {
                              // Envio irreversível pra um cliente real: uma vez
                              // no WhatsApp dele, não dá pra recolher.
                              if (
                                !window.confirm(
                                  `Enviar "${m.rotulo}" para ${nomeLabel}?\n\n` +
                                    "O arquivo vai direto pro WhatsApp do cliente e não dá pra cancelar depois.",
                                )
                              ) {
                                return;
                              }
                              setShowMateriais(false);
                              void handleSendMaterial(m);
                            }}
                            disabled={sending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition hover:bg-white/[0.05] disabled:opacity-50"
                          >
                            <span aria-hidden="true">📎</span>
                            {m.rotulo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMateriais((v) => !v);
                    setShowEmoji(false);
                    setShowQuick(false);
                  }}
                  disabled={loading}
                  aria-expanded={showMateriais}
                  aria-label="Enviar material pronto"
                  title="Materiais (catálogo, apresentação)"
                  className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-9 sm:w-9 transition hover:bg-white/[0.05] disabled:opacity-50 ${
                    showMateriais ? "text-brand" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 5.5A1.5 1.5 0 0 1 5.5 4H14l6 6v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M14 4v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Atalhos (respostas rápidas) */}
              <div ref={quickWrapRef} className="relative shrink-0">
                {showQuick && (
                  <div
                    role="dialog"
                    aria-label="Respostas rápidas"
                    className="absolute bottom-full left-0 z-20 mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line-strong bg-elevated/95 shadow-card backdrop-blur-md"
                  >
                    <div className="border-b border-line px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        Atalhos
                      </p>
                    </div>
                    <div className="scroll-slim max-h-64 overflow-y-auto p-1.5">
                      {quickLoading ? (
                        <p className="px-2 py-3 text-center text-[12px] text-ink-muted">
                          Carregando…
                        </p>
                      ) : quickErro ? (
                        <button
                          type="button"
                          onClick={() => void loadQuick()}
                          className="w-full px-2 py-3 text-center text-[12px] text-amber transition hover:text-amber/80"
                        >
                          {quickErro}
                        </button>
                      ) : !quickReplies?.length ? (
                        <p className="px-2 py-4 text-center text-[12px] text-ink-muted">
                          {admin
                            ? "Nenhum atalho ainda — crie em Ajustes."
                            : "Nenhum atalho ainda — peça ao gestor para cadastrar."}
                        </p>
                      ) : (
                        quickReplies.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              insertAtCaret(q.corpo);
                              setShowQuick(false);
                            }}
                            className="block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
                          >
                            <span className="block truncate text-[12.5px] font-semibold text-ink">
                              {q.titulo}
                            </span>
                            <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                              {q.corpo}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {/* Só admin: /config não está em VENDEDOR_PAGINAS, então o
                        consultor que clicava era redirecionado sem aviso pra
                        /prioridades — perdendo a conversa que estava escrevendo. */}
                    {admin && (
                      <div className="border-t border-line px-3 py-2">
                        <Link
                          href="/config"
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-brand transition hover:text-brand-bright"
                        >
                          <span className="text-[13px] leading-none">⚙️</span>
                          Gerenciar atalhos
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleQuick}
                  aria-expanded={showQuick}
                  aria-label="Respostas rápidas"
                  title="Respostas rápidas"
                  className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-9 sm:w-9 transition hover:bg-white/[0.05] ${
                    showQuick ? "text-brand" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <BoltIcon />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  resizeTextarea();
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !(e.nativeEvent as { isComposing?: boolean }).isComposing
                  ) {
                    e.preventDefault();
                    if (attach) void handleSendMedia();
                    else void handleSend();
                  }
                }}
                rows={1}
                placeholder={attach ? "Escreva uma legenda…" : "Escreva uma mensagem…"}
                disabled={loading}
                aria-label="Mensagem para este lead" className="scroll-slim order-first max-h-32 min-h-[36px] w-full min-w-0 flex-none resize-none bg-transparent px-1.5 py-1.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60 sm:order-none sm:w-auto sm:flex-1 sm:px-0"
              />
            </div>

            {/* Agendar o rascunho pra depois ("manda sexta às 9h") */}
            {!attach && (
              <span className="relative">
                {showAgendar && (
                  <>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={() => setShowAgendar(false)}
                      className="fixed inset-0 z-30 cursor-default"
                      tabIndex={-1}
                    />
                    <div className="card-surface absolute bottom-[calc(100%+10px)] right-0 z-40 w-[252px] rounded-2xl border border-line-strong p-3 shadow-card">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                        Agendar esta mensagem
                      </p>
                      <input
                        type="datetime-local"
                        value={quandoLocal}
                        onChange={(e) => setQuandoLocal(e.target.value)}
                        aria-label="Quando enviar"
                        className="tnum h-9 w-full rounded-lg border border-line bg-base/70 px-2.5 font-mono text-[12.5px] text-ink outline-none transition focus:border-brand/60"
                      />
                      <button
                        type="button"
                        onClick={() => void agendarMsg()}
                        disabled={agendando || !draft.trim() || !quandoLocal}
                        className="mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand text-[13px] font-semibold text-[#04140d] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {agendando ? "…" : "Agendar envio"}
                      </button>
                      {agendarErro && (
                        <p className="mt-1.5 text-[11px] leading-snug text-amber">{agendarErro}</p>
                      )}
                      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-faint">
                        Sai pelo número desta conversa, com assinatura, e pausa o
                        robô — como um envio seu.
                      </p>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!draft.trim()) {
                      setSendAviso("Escreva a mensagem primeiro — depois toque no relógio pra agendar.");
                      return;
                    }
                    setAgendarErro(null);
                    // Reaproveita o horário escolhido só se ainda for futuro.
                    setQuandoLocal((q) =>
                      q && new Date(q).getTime() > Date.now() ? q : amanhaLocal(),
                    );
                    setShowAgendar((v) => !v);
                  }}
                  disabled={sending || loading}
                  aria-expanded={showAgendar}
                  aria-label="Agendar envio desta mensagem"
                  title="Agendar envio (dia e hora)"
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2/70 transition hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                    showAgendar ? "border-brand/40 text-brand" : "text-ink-muted hover:text-brand"
                  }`}
                >
                  <ClockIcon />
                </button>
              </span>
            )}

            {/* Ação à direita: microfone quando vazio · enviar quando há conteúdo */}
            {hasContent ? (
              <button
                type="button"
                onClick={() => (attach ? void handleSendMedia() : void handleSend())}
                disabled={sending || loading}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-[#06160f] shadow-[0_2px_12px_-2px_rgba(53,176,110,0.55)] transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={attach ? "Enviar anexo" : "Enviar mensagem"}
                title={attach ? "Enviar anexo" : "Enviar (Enter)"}
              >
                {sending ? <Spinner /> : <SendIcon />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleMicStart()}
                disabled={sending || loading}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2/70 text-ink-muted transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Gravar áudio"
                title="Gravar nota de voz"
              >
                <MicIcon />
              </button>
            )}
          </div>
        )}
        <p className="mt-1.5 px-2 text-[10px] text-ink-faint">
          Enter envia · Shift+Enter quebra linha
        </p>
      </div>
    </div>
  );
}
