import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_S, signToken } from "@/lib/auth";
import { clientIp, safePath } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";

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
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { password?: string; from?: string };
      password = body.password ?? "";
      from = typeof body.from === "string" ? body.from : "/";
    } else {
      const form = await req.formData();
      password = String(form.get("password") ?? "");
      from = String(form.get("from") ?? "/");
    }
  } catch {
    // corpo inválido -> trata como senha vazia
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
