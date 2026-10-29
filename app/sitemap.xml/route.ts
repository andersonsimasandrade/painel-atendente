import { SITE_HOST, SITE_URL } from "@/lib/site";
import { postsParaSitemap } from "@/lib/blog";
import { listarPaginas } from "@/lib/paginas";

export const dynamic = "force-dynamic";

const PAGINAS = ["/", "/agendar", "/capoeiras", "/centro", "/duvidas", "/tratamentos", "/blog", "/privacidade", "/termos", "/exclusao-de-dados"];

export async function GET(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  if (host !== SITE_HOST) return new Response("Not found", { status: 404 });
  const hoje = new Date().toISOString().slice(0, 10);

  // Artigos do blog (lastmod = data da última atualização). Se o banco falhar, o sitemap segue com as páginas fixas.
  const posts = await postsParaSitemap().catch(() => []);
  const servicos = await listarPaginas().catch(() => []);
  const ultimoPost = posts.length ? posts.map((x) => x.atualizado_em.slice(0, 10)).sort().pop() : undefined;

  const itens = [
    ...PAGINAS.map(
      (p) =>
        `  <url><loc>${SITE_URL}${p === "/" ? "" : p}</loc><lastmod>${p === "/blog" && ultimoPost ? ultimoPost : hoje}</lastmod></url>`,
    ),
    ...servicos.map((x) => `  <url><loc>${SITE_URL}/${x.slug}</loc><lastmod>${x.atualizado_em.slice(0, 10)}</lastmod></url>`),
    ...posts.map((x) => `  <url><loc>${SITE_URL}/blog/${x.slug}</loc><lastmod>${x.atualizado_em.slice(0, 10)}</lastmod></url>`),
  ].join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
