import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_S, signToken } from "@/lib/auth";
import { clientIp, safePath } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { normalizarEmail, usuarioParaSenha } from "@/lib/magiclink";
import { verificarSenha } from "@/lib/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const configured = process.env.DASHBOARD_PASSWORD;

  // Rate limit por IP: no máx. 8 tentativas a cada 10 min (anti brute-force).
  if (await rateLimited(`login:${clientIp(req)}`, 8, 600)) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  let password = "";
  let from = "/";
  let email = "";
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { password?: string; from?: string; email?: string };
      password = body.password ?? "";
      from = typeof body.from === "string" ? body.from : "/";
      email = normalizarEmail(body.email);
    } else {
      const form = await req.formData();
      password = String(form.get("password") ?? "");
      from = String(form.get("from") ?? "/");
      email = normalizarEmail(form.get("email"));
    }
  } catch {
    // corpo inválido -> trata como senha vazia
  }

  // E-MAIL + SENHA PRÓPRIA (cada pessoa tem a sua, guardada só como hash).
  if (email) {
    const erroGenerico = NextResponse.json({ ok: false, error: "E-mail ou senha incorretos." }, { status: 401 });
    if (email.length > 200 || password.length > 200) return erroGenerico;
    // Freio por e-mail também: quem tenta adivinhar a senha de alguém não passa de 6 tentativas em 15 min.
    if (await rateLimited(`loginmail:${email}`, 6, 900)) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
    }
    const u = await usuarioParaSenha(email);
    const ok = await verificarSenha(password, u?.hash);
    if (!u || !u.hash || !ok) return erroGenerico;
    if (!u.papel || (u.papel === "vendedor" && !u.vslug)) {
      return NextResponse.json({ ok: false, error: "Acesso não configurado. Fale com o administrador." }, { status: 403 });
    }
    const token = await signToken(email, u.papel, u.vslug);
    const destino = u.papel === "vendedor" ? "/prioridades" : safePath(from);
    const res = NextResponse.json({ ok: true, redirect: destino });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    });
    return res;
  }

  if (!configured) {
    return NextResponse.json(
      { ok: false, error: "DASHBOARD_PASSWORD não configurada no servidor." },
      { status: 500 },
    );
  }

  // Comparação em tempo constante para evitar timing attacks básicos.
  const a = password;
  const b = configured;
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  if (mismatch !== 0) {
    return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
  }

  // Login por senha é o acesso de ADMIN (emergência). Explícito de propósito:
  // antes dependia do default de getSessionClaims, o que deixava a regra de
  // papel escondida num fallback.
  const token = await signToken(undefined, "admin");
  const safeFrom = safePath(from);

  const res = NextResponse.json({ ok: true, redirect: safeFrom });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
