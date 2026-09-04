import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_S, signToken } from "@/lib/auth";
import { consumirMagicToken, dadosUsuario } from "@/lib/magiclink";
import { appBaseUrl, safePath } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verificação do magic link.
//
// GET  = só MOSTRA a confirmação. Não consome nada.
// POST = consome o token, cria a sessão e entra.
//
// POR QUE ASSIM: o token é de uso único, e antivírus de e-mail e o navegador
// abrem o link sozinhos pra checar se é seguro. Isso queimava o acesso antes da
// pessoa clicar — 8 dos 11 últimos links foram consumidos em menos de um
// minuto, e o dono via "link expirado ou já usado".
//
// Robô segue link (GET). Robô não aperta botão (POST). O GET ficou inofensivo.

/** GET /api/auth/verify?token=...&from=... → tela de confirmação. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const from = safePath(url.searchParams.get("from"));
  const base = appBaseUrl();

  if (!token) return NextResponse.redirect(new URL("/login?erro=link", base));

  const destino = new URL("/entrar", base);
  destino.searchParams.set("token", token);
  if (from !== "/") destino.searchParams.set("from", from);
  return NextResponse.redirect(destino);
}

/** POST /api/auth/verify  { token, from } → consome e cria a sessão. */
export async function POST(req: Request) {
  const base = appBaseUrl();

  let token = "";
  let fromBruto: string | null = null;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { token?: unknown; from?: unknown };
      token = String(body.token ?? "");
      fromBruto = typeof body.from === "string" ? body.from : null;
    } else {
      const form = await req.formData();
      token = String(form.get("token") ?? "");
      fromBruto = String(form.get("from") ?? "");
    }
  } catch {
    return NextResponse.redirect(new URL("/login?erro=link", base));
  }

  const from = safePath(fromBruto);
  const email = await consumirMagicToken(token.trim());
  if (!email) {
    return NextResponse.redirect(new URL("/login?erro=link", base));
  }

  const { papel, vslug } = await dadosUsuario(email);
  // FAIL-CLOSED: papel não resolvido (falha do banco) OU vendedor sem slug =
  // estado inválido → NÃO emite sessão (evita escalonar vendedor→admin ou
  // vendedor sem escopo ver tudo).
  if (!papel || (papel === "vendedor" && !vslug)) {
    return NextResponse.redirect(new URL("/login?erro=config", base));
  }
  // Vendedor cai na fila de trabalho dele (/prioridades = "quem eu chamo
  // agora"); admin respeita o destino pedido.
  const destino = papel === "vendedor" ? "/prioridades" : from;
  const session = await signToken(email, papel, vslug);

  // 303: troca o POST por um GET no destino, senão o navegador reenviaria o
  // formulário (e o token já estaria queimado) num F5.
  const res = NextResponse.redirect(new URL(destino, base), 303);
  res.cookies.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
