import { getClient } from "@/lib/db";

// Ligação com o YouTube (YouTube Data API v3) por OAuth do dono do canal.
// Variáveis: YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET (criadas no Google Cloud).
// O refresh_token fica na tabela yt_credencial (id = 1). Nunca sai do servidor.

const ESCOPO = "https://www.googleapis.com/auth/youtube.force-ssl";
const BASE = "https://www.googleapis.com/youtube/v3";

export function youtubeConfigurado(): boolean {
  return !!(process.env.YOUTUBE_CLIENT_ID ?? "").trim() && !!(process.env.YOUTUBE_CLIENT_SECRET ?? "").trim();
}

export function redirectUri(): string {
  const base = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "") || "https://painel.andersonandradefisio.com.br";
  return `${base}/api/youtube/callback`;
}

export function urlDeAutorizacao(state: string): string {
  const p = new URLSearchParams({
    client_id: (process.env.YOUTUBE_CLIENT_ID ?? "").trim(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function pedirToken(corpo: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: (process.env.YOUTUBE_CLIENT_ID ?? "").trim(),
      client_secret: (process.env.YOUTUBE_CLIENT_SECRET ?? "").trim(),
      ...corpo,
    }),
    signal: AbortSignal.timeout(20000),
  });
  return (await r.json().catch(() => ({}))) as Awaited<ReturnType<typeof pedirToken>>;
}

/** Troca o código devolvido pelo Google e guarda a credencial. */
export async function concluirAutorizacao(code: string): Promise<{ ok: boolean; canal?: string; erro?: string }> {
  const t = await pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.access_token) return { ok: false, erro: t.error_description ?? t.error ?? "o Google não devolveu a chave" };
  if (!t.refresh_token) return { ok: false, erro: "o Google não devolveu a chave de longa duração; refaça a autorização" };
  const c = await fetch(`${BASE}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${t.access_token}` },
    signal: AbortSignal.timeout(20000),
  });
  const j = (await c.json().catch(() => ({}))) as { items?: { id: string; snippet?: { title?: string } }[] };
  const canal = j.items?.[0];
  if (!canal) return { ok: false, erro: "essa conta do Google não tem um canal do YouTube" };
  const sb = getClient();
  const up = await sb.from("yt_credencial").upsert({
    id: 1,
    refresh_token: t.refresh_token,
    canal_id: canal.id,
    canal_nome: canal.snippet?.title ?? null,
    conectado_em: new Date().toISOString(),
  });
  if (up.error) return { ok: false, erro: up.error.message };
  return { ok: true, canal: canal.snippet?.title ?? canal.id };
}

export interface CredencialYT {
  refresh_token: string;
  canal_id: string | null;
  canal_nome: string | null;
}

export async function credencialYT(): Promise<CredencialYT | null> {
  const r = await getClient().from("yt_credencial").select("refresh_token, canal_id, canal_nome").eq("id", 1).limit(1);
  return ((r.data?.[0] ?? null) as CredencialYT | null) ?? null;
}

let cache: { token: string; ate: number } | null = null;

async function tokenDeAcesso(cred: CredencialYT): Promise<string> {
  if (cache && cache.ate > Date.now() + 60_000) return cache.token;
  const t = await pedirToken({ refresh_token: cred.refresh_token, grant_type: "refresh_token" });
  if (!t.access_token) throw new Error(`Google recusou a chave do YouTube: ${t.error_description ?? t.error ?? "sem resposta"}`);
  cache = { token: t.access_token, ate: Date.now() + (t.expires_in ?? 3000) * 1000 };
  return t.access_token;
}

export interface ThreadYT {
  id: string; // id do comentário principal
  video_id: string | null;
  autor_id: string | null;
  autor_nome: string | null;
  texto: string;
  publicado_em: string;
  respostas: number;
}

/** Comentários principais do canal (todos os vídeos), do mais novo para o mais antigo. */
export async function listarComentarios(cred: CredencialYT, paginas = 3): Promise<ThreadYT[]> {
  if (!cred.canal_id) return [];
  const token = await tokenDeAcesso(cred);
  const out: ThreadYT[] = [];
  let pagina = "";
  for (let i = 0; i < paginas; i++) {
    const p = new URLSearchParams({ part: "snippet", allThreadsRelatedToChannelId: cred.canal_id, order: "time", maxResults: "50", textFormat: "plainText" });
    if (pagina) p.set("pageToken", pagina);
    const r = await fetch(`${BASE}/commentThreads?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`YouTube commentThreads ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as {
      nextPageToken?: string;
      items?: {
        id: string;
        snippet?: {
          videoId?: string;
          totalReplyCount?: number;
          topLevelComment?: { snippet?: { authorDisplayName?: string; authorChannelId?: { value?: string }; textOriginal?: string; publishedAt?: string } };
        };
      }[];
    };
    for (const it of j.items ?? []) {
      const s = it.snippet?.topLevelComment?.snippet;
      out.push({
        id: it.id,
        video_id: it.snippet?.videoId ?? null,
        autor_id: s?.authorChannelId?.value ?? null,
        autor_nome: s?.authorDisplayName ?? null,
        texto: (s?.textOriginal ?? "").slice(0, 2000),
        publicado_em: s?.publishedAt ?? new Date().toISOString(),
        respostas: it.snippet?.totalReplyCount ?? 0,
      });
    }
    if (!j.nextPageToken) break;
    pagina = j.nextPageToken;
  }
  return out;
}

/** Responde publicamente a um comentário (custa 50 unidades da cota diária de 10 mil). */
export async function responderComentarioYT(cred: CredencialYT, comentarioId: string, texto: string): Promise<{ ok: boolean; id?: string; erro?: string }> {
  try {
    const token = await tokenDeAcesso(cred);
    const r = await fetch(`${BASE}/comments?part=snippet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ snippet: { parentId: comentarioId, textOriginal: texto } }),
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!r.ok) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "erro" };
  }
}
