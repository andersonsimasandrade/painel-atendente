// Cliente mínimo da Evolution API (WhatsApp) — SOMENTE no servidor. Nunca
// importe isto em um Client Component: lê EVOLUTION_API_KEY do ambiente.
//
// ENV:
//   EVOLUTION_API_URL   ex.: https://SUA-EVOLUTION.seudominio.com.br
//   EVOLUTION_INSTANCE  nome da instância (o MESMO usado no n8n e na tabela
//                       vendedores.instancia_whatsapp)
//   EVOLUTION_API_KEY   chave de API da instância
//
// Falta de env NÃO derruba a página: devolvemos { ok:false, error } claro.

export interface EvolutionSendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * ATENÇÃO: envia pela instância do ENV, sem noção de qual consultor fala com
 * este lead. Para qualquer envio ligado a uma CONVERSA use
 * `enviarTextoInstancia` com a instância vinda de `canalDaConversa`.
 *
 * Envia uma mensagem de texto pelo WhatsApp via Evolution.
 * POST `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`
 * headers { apikey, Content-Type }, body { number, text }.
 * Enviamos SEM prefixo com o nome do atendente. HTTP 200/201 = sucesso.
 *
 * ATENÇÃO: na maioria das versões da Evolution, o que sai pela API não volta
 * como webhook — mas ALGUMAS versões ecoam o próprio envio com `fromMe: true`.
 * Por isso quem pausa o robô é a rota /enviar, chamando o webhook de pausa
 * antes de mandar a mensagem, e não o eco. Se você vir mensagens do painel
 * duplicadas na conversa, é essa a causa.
 */
export async function enviarTextoWhatsApp(
  telefone: string,
  texto: string,
): Promise<EvolutionSendResult> {
  const base = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apikey = process.env.EVOLUTION_API_KEY;

  if (!base || !apikey || !instance) {
    return {
      ok: false,
      error:
        "Evolution não configurada (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e " +
        "EVOLUTION_INSTANCE no ambiente).",
    };
  }

  const url = `${base.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instance)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: telefone, text: texto }),
      cache: "no-store",
    });

    if (res.status === 200 || res.status === 201) {
      return { ok: true, status: res.status };
    }

    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore corpo ilegível */
    }
    return {
      ok: false,
      status: res.status,
      error: `Evolution respondeu ${res.status}${detail ? `: ${detail}` : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao contatar a Evolution.",
    };
  }
}

/**
 * Envia texto por uma instância NOMEADA (p/ multi-vendedor: cada vendedor tem
 * a sua instância). Reusa base/chave do env; só o nome da instância varia.
 */
export async function enviarTextoInstancia(
  instancia: string,
  telefone: string,
  texto: string,
): Promise<EvolutionSendResult> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada." };
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instancia)}`,
      {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: telefone, text: texto }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (res.status === 200 || res.status === 201) return { ok: true, status: res.status };
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error: `Evolution ${res.status}${detail ? `: ${detail}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar a Evolution." };
  }
}

function evoEnv(): { base?: string; instance: string; apikey?: string } {
  return {
    base: process.env.EVOLUTION_API_URL,
    instance: process.env.EVOLUTION_INSTANCE ?? "",
    apikey: process.env.EVOLUTION_API_KEY,
  };
}

// Remove o prefixo "data:...;base64," se vier (o Evolution quer base64 puro).
function soBase64(s: string): string {
  const i = s.indexOf("base64,");
  return i !== -1 ? s.slice(i + 7) : s;
}

/** Envia uma nota de voz (áudio) pelo WhatsApp via Evolution. `audioBase64`
 * pode vir como data URI ou base64 puro. */
export async function enviarAudioWhatsApp(
  telefone: string,
  audioBase64: string,
  instancia?: string,
): Promise<EvolutionSendResult> {
  const env = evoEnv();
  const { base, apikey } = env;
  const instance = instancia || env.instance;
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada." };
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: telefone, audio: soBase64(audioBase64) }),
        cache: "no-store",
      },
    );
    if (res.status === 200 || res.status === 201) return { ok: true, status: res.status };
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error: `Evolution ${res.status}${detail ? `: ${detail}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar a Evolution." };
  }
}

export interface MidiaInput {
  mediatype: "image" | "document" | "video";
  mimetype: string;
  media: string; // base64 (data URI ou puro) OU URL
  fileName?: string;
  caption?: string;
}

/** Envia imagem/documento/vídeo pelo WhatsApp via Evolution (sendMedia). */
export async function enviarMidiaWhatsApp(
  telefone: string,
  m: MidiaInput,
  instancia?: string,
): Promise<EvolutionSendResult> {
  const env = evoEnv();
  const { base, apikey } = env;
  const instance = instancia || env.instance;
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada." };
  const media = m.media.startsWith("data:") ? soBase64(m.media) : m.media;
  const body: Record<string, unknown> = {
    number: telefone,
    mediatype: m.mediatype,
    mimetype: m.mimetype,
    media,
  };
  if (m.fileName) body.fileName = m.fileName;
  if (m.caption) body.caption = m.caption;
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/message/sendMedia/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    if (res.status === 200 || res.status === 201) return { ok: true, status: res.status };
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error: `Evolution ${res.status}${detail ? `: ${detail}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar a Evolution." };
  }
}

export interface EvolutionState {
  ok: boolean;
  state?: string; // 'open' | 'connecting' | 'close' | 'unknown'
  instance?: string;
  error?: string;
}

/** Estado da conexão da instância (open = conectada). Read-only.
 *  `qual` (opcional) escolhe a instância — multi-consultor. */
export async function evolutionState(qual?: string): Promise<EvolutionState> {
  const env = evoEnv();
  const base = env.base;
  const apikey = env.apikey;
  const instance = qual || env.instance;
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada." };
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/instance/connectionState/${encodeURIComponent(instance)}`,
      { headers: { apikey }, cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    const j = (await res.json().catch(() => ({}))) as {
      instance?: { state?: string };
      state?: string;
    };
    if (!res.ok) return { ok: false, error: `Evolution respondeu ${res.status}` };
    const state = j?.instance?.state ?? j?.state ?? "unknown";
    return { ok: true, state: String(state), instance };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar a Evolution." };
  }
}

export interface EvolutionConnect {
  ok: boolean;
  state?: string;
  base64?: string; // imagem do QR (data:image/png;base64,...)
  code?: string; // string do QR
  pairingCode?: string; // código de pareamento (alternativa ao QR)
  error?: string;
}

/**
 * Inicia a conexão da instância. Se estiver desconectada, a Evolution devolve o
 * QR (base64) e/ou um pairingCode para re-parear o WhatsApp. Se já estiver
 * conectada, devolve o state 'open' sem QR (chamada não-destrutiva).
 */
export async function evolutionConnect(qual?: string): Promise<EvolutionConnect> {
  const env = evoEnv();
  const base = env.base;
  const apikey = env.apikey;
  const instance = qual || env.instance;
  if (!base || !apikey) return { ok: false, error: "Evolution não configurada." };
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/instance/connect/${encodeURIComponent(instance)}`,
      { headers: { apikey }, cache: "no-store", signal: AbortSignal.timeout(20000) },
    );
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: `Evolution respondeu ${res.status}` };
    // Formatos possíveis: campos na raiz OU aninhados em `qrcode`.
    const q = (j.qrcode as Record<string, unknown> | undefined) ?? j;
    const pick = (o: Record<string, unknown> | undefined, k: string) =>
      o && typeof o[k] === "string" ? (o[k] as string) : undefined;
    const state =
      (j.instance as { state?: string } | undefined)?.state ??
      (typeof j.state === "string" ? j.state : undefined);
    return {
      ok: true,
      state: state ? String(state) : undefined,
      base64: pick(q, "base64") ?? pick(j, "base64"),
      code: pick(q, "code") ?? pick(j, "code"),
      pairingCode: pick(q, "pairingCode") ?? pick(j, "pairingCode"),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao contatar a Evolution." };
  }
}
