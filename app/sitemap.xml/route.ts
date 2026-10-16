import { SITE_HOST, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGINAS = ["/", "/agendar", "/capoeiras", "/centro", "/duvidas", "/privacidade", "/exclusao-de-dados"];

export function GET(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  if (host !== SITE_HOST) return new Response("Not found", { status: 404 });
  const hoje = new Date().toISOString().slice(0, 10);
  const itens = PAGINAS.map(
    (p) =>
      `  <url><loc>${SITE_URL}${p === "/" ? "" : p}</loc><lastmod>${hoje}</lastmod></url>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
