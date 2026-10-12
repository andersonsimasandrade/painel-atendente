import { SITE_HOST, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// O mesmo servidor atende o site (andersonandradefisio.com.br) e o painel.
// O site pode ser indexado; o painel NUNCA.
export function GET(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  const ehSite = host === SITE_HOST;
  const corpo = ehSite
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(corpo, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
