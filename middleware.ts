import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, getSessionClaims } from "./lib/auth";
import { vendedorPodeAcessar } from "./lib/perm";

// Protege todas as rotas exceto /login, as rotas de auth e assets estáticos.
export async function middleware(req: NextRequest) {
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
    const path = req.nextUrl.pathname;
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
  matcher: [
    // Tudo, menos: login, /entrar (confirmação do magic link — quem chega ali
    // AINDA não tem sessão, é justamente onde vai criá-la), rotas de auth
    // (senha + magic link), internos do Next, favicon e arquivos com extensão.
    //
    // Cada exceção termina em `(?:/|$)` DE PROPÓSITO. Sem essa âncora, o
    // lookahead casa por PREFIXO e uma rota futura chamada /entrarada ou
    // /loginhack nasceria pública — sem erro, sem aviso, painel aberto.
    "/((?!(?:login|entrar|api/login|api/logout|api/auth|api/cron|agendar|api/agendar|_next/static|_next/image|favicon\\.ico|logo\\.svg)(?:/|$)|.*\\.).*)",
  ],
};
