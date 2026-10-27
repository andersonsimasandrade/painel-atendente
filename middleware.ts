import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, getSessionClaims } from "./lib/auth";
import { vendedorPodeAcessar } from "./lib/perm";
import { SITE_HOST } from "./lib/site";

// O MESMO servidor atende dois endereços:
//   • andersonandradefisio.com.br      → site público (páginas em app/site/*)
//   • painel.andersonandradefisio...   → painel (login obrigatório)
// O endereço do site NUNCA alcança as telas do painel: tudo é reescrito para
// /site/... ou /api/site/..., sem passar pela checagem de login.

// Rotas do PAINEL que são públicas de propósito (antes isso vivia no matcher).
// Cada item termina em (?:/|$) para não casar por prefixo: sem a âncora, uma
// rota futura chamada /loginhack nasceria pública.
const PUBLICAS_DO_PAINEL =
  /^\/(?:login|entrar|api\/login|api\/logout|api\/auth|api\/cron|api\/blog\/revalidar|api\/ingest|api\/agenda\/sync|api\/instagram\/webhook|agendar|api\/agendar|_next\/static|_next\/image|favicon\.ico|logo\.svg)(?:\/|$)/;

function hostDe(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export async function middleware(req: NextRequest) {
  const host = hostDe(req);
  const path = req.nextUrl.pathname;

  // ── Site público ───────────────────────────────────────────────────────
  if (host === `www.${SITE_HOST}`) {
    return NextResponse.redirect(`https://${SITE_HOST}${path}${req.nextUrl.search}`, 308);
  }
  // site.localhost só resolve no próprio computador (testes locais); em produção é inócuo.
  if (host === SITE_HOST || host === "site.localhost") {
    // API do site, robots/sitemap e arquivos estáticos (têm ponto) passam direto.
    if (path.startsWith("/api/site/") || path.includes(".")) return NextResponse.next();
    // Qualquer outra rota de API ou de painel não existe neste endereço.
    if (path.startsWith("/api/") || path.startsWith("/site")) {
      return new NextResponse("Not found", { status: 404 });
    }
    const url = req.nextUrl.clone();
    url.pathname = path === "/" ? "/site" : `/site${path}`;
    return NextResponse.rewrite(url);
  }

  // ── Painel ─────────────────────────────────────────────────────────────
  // Públicas do painel e arquivos com extensão: sem login.
  if (PUBLICAS_DO_PAINEL.test(path) || path.includes(".")) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const claims = await getSessionClaims(token);

  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserva o destino para redirecionar de volta após o login.
    const from = req.nextUrl.pathname + req.nextUrl.search;
    if (from && from !== "/login") url.searchParams.set("from", from);
    return NextResponse.redirect(url);
  }

  // Papel 'vendedor' só acessa suas seções (leads/agenda/conversas/prioridades).
  if (claims.papel === "vendedor") {
    if (!vendedorPodeAcessar(path)) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/prioridades";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Roda em tudo, menos nos internos do Next. A decisão "público ou não" agora
  // é tomada acima, porque depende do ENDEREÇO (host), que o matcher não vê.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
