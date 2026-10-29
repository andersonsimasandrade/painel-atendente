// PÁGINAS DE SERVIÇO do site (andersonandradefisio.com.br/<slug>): quiropraxia, osteopatia, coluna, ombro, joelho...
// Escritas pela Central Viral na tabela public.site_paginas do mesmo Supabase; o site só LÊ e mostra (igual ao blog).
// Só aparece o que está 'publicado' e com publicado_em já passado. Cache de 1 hora com a tag 'paginas'
// (o webhook /api/blog/revalidar limpa as duas tags na hora).
import { unstable_cache } from "next/cache";
import { getClient } from "./db";
import type { Fonte, Pergunta } from "./blog";

export interface PaginaServico {
  slug: string;
  titulo: string;
  titulo_seo: string | null;
  rotulo: string;
  descricao: string;
  corpo_md: string;
  imagem_url: string | null;
  imagem_alt: string | null;
  video_url: string | null;
  local: "capoeiras" | "centro" | "ambos";
  tags: string[];
  fontes: Fonte[];
  faq: Pergunta[];
  ordem: number;
  publicado_em: string;
  atualizado_em: string;
}
export type PaginaResumo = Pick<PaginaServico, "slug" | "titulo" | "rotulo" | "descricao" | "ordem" | "atualizado_em">;

const TTL = 3600;
const COLUNAS =
  "slug, titulo, titulo_seo, rotulo, descricao, corpo_md, imagem_url, imagem_alt, video_url, local, tags, fontes, faq, ordem, publicado_em, atualizado_em";
const COLUNAS_RESUMO = "slug, titulo, rotulo, descricao, ordem, atualizado_em";

const urlHttp = (u: unknown): string | null => {
  const s = typeof u === "string" ? u.trim() : "";
  return /^https?:\/\//i.test(s) ? s : null;
};

function normalizar(r: Record<string, unknown>): PaginaServico {
  const fontes = (Array.isArray(r.fontes) ? r.fontes : [])
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      const url = urlHttp(o.url);
      return url ? { titulo: String(o.titulo ?? url).slice(0, 200), url } : null;
    })
    .filter((x): x is Fonte => !!x);
  const faq = (Array.isArray(r.faq) ? r.faq : [])
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      const pergunta = String(o.pergunta ?? "").trim();
      const resposta = String(o.resposta ?? "").trim();
      return pergunta && resposta ? { pergunta, resposta } : null;
    })
    .filter((x): x is Pergunta => !!x);
  const local = r.local === "capoeiras" || r.local === "centro" ? r.local : "ambos";
  return {
    slug: String(r.slug),
    titulo: String(r.titulo),
    titulo_seo: typeof r.titulo_seo === "string" && r.titulo_seo.trim() ? r.titulo_seo.trim() : null,
    rotulo: String(r.rotulo ?? r.titulo),
    descricao: String(r.descricao ?? ""),
    corpo_md: String(r.corpo_md ?? ""),
    imagem_url: urlHttp(r.imagem_url) ?? (typeof r.imagem_url === "string" && r.imagem_url.startsWith("/") ? r.imagem_url : null),
    imagem_alt: typeof r.imagem_alt === "string" ? r.imagem_alt : null,
    video_url: urlHttp(r.video_url),
    local,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    fontes,
    faq,
    ordem: Number(r.ordem ?? 100),
    publicado_em: String(r.publicado_em),
    atualizado_em: String(r.atualizado_em ?? r.publicado_em),
  };
}

const agoraISO = () => new Date().toISOString();
// Só no computador (next dev): PAGINAS_PREVIA=1 mostra também os rascunhos, para conferir antes de publicar.
const PREVIA = process.env.NODE_ENV !== "production" && process.env.PAGINAS_PREVIA === "1";

export const paginaPorSlug = unstable_cache(
  async (slug: string): Promise<PaginaServico | null> => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
    const q = getClient().from("site_paginas").select(COLUNAS).eq("slug", slug);
    const r = await (PREVIA ? q : q.eq("status", "publicado").lte("publicado_em", agoraISO())).limit(1);
    if (r.error) throw new Error(r.error.message);
    const row = (r.data?.[0] ?? null) as Record<string, unknown> | null;
    return row ? normalizar(row) : null;
  },
  ["pagina-servico"],
  { revalidate: TTL, tags: ["paginas"] },
);

/** Todas as publicadas, na ordem do menu (para /tratamentos, o rodapé e o sitemap). */
export const listarPaginas = unstable_cache(
  async (): Promise<PaginaResumo[]> => {
    const r = await getClient()
      .from("site_paginas")
      .select(COLUNAS_RESUMO)
      .eq("status", "publicado")
      .lte("publicado_em", agoraISO())
      .order("ordem", { ascending: true })
      .order("publicado_em", { ascending: true })
      .limit(200);
    if (r.error) throw new Error(r.error.message);
    return ((r.data ?? []) as Record<string, unknown>[]).map((x) => {
      const n = normalizar({ ...x, corpo_md: "" });
      return { slug: n.slug, titulo: n.titulo, rotulo: n.rotulo, descricao: n.descricao, ordem: n.ordem, atualizado_em: n.atualizado_em };
    });
  },
  ["paginas-lista"],
  { revalidate: TTL, tags: ["paginas"] },
);

/** Endereço de incorporação do vídeo (YouTube ou Vimeo). Outros endereços não são incorporados. */
export function videoIncorporado(url: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
