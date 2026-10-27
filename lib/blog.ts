// BLOG do site: os artigos são escritos por outro projeto (Central Viral) na tabela public.blog_posts do mesmo
// Supabase; o site só LÊ e mostra. Só aparece o que está com status 'publicado' e publicado_em já passado
// (a RLS do banco garante o mesmo para leituras anônimas; aqui filtramos de novo porque o painel usa a service role).
// Cache de 1 hora (revalidateTag('blog') pelo webhook /api/blog/revalidar atualiza na hora).
import { unstable_cache } from "next/cache";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getClient } from "./db";

export interface Fonte {
  titulo: string;
  url: string;
}
export interface Pergunta {
  pergunta: string;
  resposta: string;
}
export interface BlogPost {
  slug: string;
  titulo: string;
  descricao: string;
  corpo_md: string;
  imagem_url: string | null;
  imagem_alt: string | null;
  local: "capoeiras" | "centro" | "ambos";
  tags: string[];
  fontes: Fonte[];
  faq: Pergunta[];
  post_instagram: string | null;
  publicado_em: string;
  atualizado_em: string;
}
export type BlogResumo = Pick<BlogPost, "slug" | "titulo" | "descricao" | "imagem_url" | "imagem_alt" | "local" | "tags" | "publicado_em">;

export const POSTS_POR_PAGINA = 9;
const TTL = 3600;
const COLUNAS = "slug, titulo, descricao, corpo_md, imagem_url, imagem_alt, local, tags, fontes, faq, post_instagram, publicado_em, atualizado_em";
const COLUNAS_RESUMO = "slug, titulo, descricao, imagem_url, imagem_alt, local, tags, publicado_em";

const urlHttp = (u: unknown): string | null => {
  const s = typeof u === "string" ? u.trim() : "";
  return /^https?:\/\//i.test(s) ? s : null;
};

function normalizar(r: Record<string, unknown>): BlogPost {
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
    descricao: String(r.descricao ?? ""),
    corpo_md: String(r.corpo_md ?? ""),
    imagem_url: urlHttp(r.imagem_url) ?? (typeof r.imagem_url === "string" && r.imagem_url.startsWith("/") ? r.imagem_url : null),
    imagem_alt: typeof r.imagem_alt === "string" ? r.imagem_alt : null,
    local,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    fontes,
    faq,
    post_instagram: urlHttp(r.post_instagram),
    publicado_em: String(r.publicado_em),
    atualizado_em: String(r.atualizado_em ?? r.publicado_em),
  };
}

const agoraISO = () => new Date().toISOString();

/** Lista paginada, do mais novo para o mais antigo. */
export const listarPosts = unstable_cache(
  async (pagina: number): Promise<{ posts: BlogResumo[]; total: number; paginas: number }> => {
    const p = Math.max(1, Math.floor(pagina) || 1);
    const de = (p - 1) * POSTS_POR_PAGINA;
    const r = await getClient()
      .from("blog_posts")
      .select(COLUNAS_RESUMO, { count: "exact" })
      .eq("status", "publicado")
      .lte("publicado_em", agoraISO())
      .order("publicado_em", { ascending: false })
      .range(de, de + POSTS_POR_PAGINA - 1);
    if (r.error) throw new Error(r.error.message);
    const total = r.count ?? 0;
    return {
      posts: ((r.data ?? []) as Record<string, unknown>[]).map((x) => {
        const n = normalizar({ ...x, corpo_md: "" });
        const { slug, titulo, descricao, imagem_url, imagem_alt, local, tags, publicado_em } = n;
        return { slug, titulo, descricao, imagem_url, imagem_alt, local, tags, publicado_em };
      }),
      total,
      paginas: Math.max(1, Math.ceil(total / POSTS_POR_PAGINA)),
    };
  },
  ["blog-lista"],
  { revalidate: TTL, tags: ["blog"] },
);

export const postPorSlug = unstable_cache(
  async (slug: string): Promise<BlogPost | null> => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
    const r = await getClient()
      .from("blog_posts")
      .select(COLUNAS)
      .eq("slug", slug)
      .eq("status", "publicado")
      .lte("publicado_em", agoraISO())
      .limit(1);
    if (r.error) throw new Error(r.error.message);
    const row = (r.data?.[0] ?? null) as Record<string, unknown> | null;
    return row ? normalizar(row) : null;
  },
  ["blog-post"],
  { revalidate: TTL, tags: ["blog"] },
);

/** 2 artigos relacionados: mesma tag ou mesmo consultório primeiro; se faltar, os mais recentes. */
export const relacionados = unstable_cache(
  async (slug: string, tags: string[], local: string): Promise<BlogResumo[]> => {
    const r = await getClient()
      .from("blog_posts")
      .select(COLUNAS_RESUMO)
      .eq("status", "publicado")
      .lte("publicado_em", agoraISO())
      .neq("slug", slug)
      .order("publicado_em", { ascending: false })
      .limit(60);
    if (r.error) throw new Error(r.error.message);
    const lista = ((r.data ?? []) as Record<string, unknown>[]).map((x) => normalizar({ ...x, corpo_md: "" }));
    const pontos = (p: BlogPost) =>
      p.tags.filter((t) => tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())).length * 2 + (p.local === local || p.local === "ambos" || local === "ambos" ? 1 : 0);
    return lista
      .map((p) => ({ p, pts: pontos(p) }))
      .sort((a, b) => b.pts - a.pts || new Date(b.p.publicado_em).getTime() - new Date(a.p.publicado_em).getTime())
      .slice(0, 2)
      .map(({ p }) => ({ slug: p.slug, titulo: p.titulo, descricao: p.descricao, imagem_url: p.imagem_url, imagem_alt: p.imagem_alt, local: p.local, tags: p.tags, publicado_em: p.publicado_em }));
  },
  ["blog-relacionados"],
  { revalidate: TTL, tags: ["blog"] },
);

/** Para o sitemap: todos os publicados com a data de atualização. */
export const postsParaSitemap = unstable_cache(
  async (): Promise<{ slug: string; atualizado_em: string }[]> => {
    const r = await getClient()
      .from("blog_posts")
      .select("slug, atualizado_em")
      .eq("status", "publicado")
      .lte("publicado_em", agoraISO())
      .order("publicado_em", { ascending: false })
      .limit(5000);
    if (r.error) throw new Error(r.error.message);
    return (r.data ?? []) as { slug: string; atualizado_em: string }[];
  },
  ["blog-sitemap"],
  { revalidate: TTL, tags: ["blog"] },
);

/** Foto do autor: se o arquivo public/img/anderson.(webp|jpg|jpeg|png) existir, usa; senão, monograma. */
export function fotoDoAutor(): string | null {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    if (existsSync(join(process.cwd(), "public", "img", `anderson.${ext}`))) return `/img/anderson.${ext}`;
  }
  return null;
}

const FMT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
export const dataLonga = (iso: string) => FMT.format(new Date(iso));

/** Minutos de leitura (~200 palavras por minuto). */
export function minutosDeLeitura(md: string): number {
  const palavras = md.replace(/[#>*_`\[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}
