import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_S, signToken } from "@/lib/auth";
import { consumirMagicToken, dadosUsuario, gravarSenha } from "@/lib/magiclink";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { hashSenha, validarSenhaNova } from "@/lib/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/redefinir  { token, senha }
// Quem recebeu o link por e-mail escolhe a senha nova. O token só é gasto aqui (POST), nunca ao abrir o link, para o
// antivírus do e-mail não queimar o acesso. Depois de salvar, a pessoa já entra no painel.
export async function POST(req: Request) {
  if (await rateLimited(`redefinir:${clientIp(req)}`, 15, 900)) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
  }
  let token = "";
  let senha = "";
  try {
    const b = (await req.json()) as { token?: unknown; senha?: unknown };
    token = String(b.token ?? "").trim();
    senha = String(b.senha ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const erroSenha = validarSenhaNova(senha);
  if (erroSenha) return NextResponse.json({ ok: false, error: erroSenha }, { status: 400 });

  const email = await consumirMagicToken(token, "senha");
  if (!email) {
    return NextResponse.json({ ok: false, error: "Esse link venceu ou já foi usado. Peça um novo na tela de entrada." }, { status: 400 });
  }
  const { papel, vslug } = await dadosUsuario(email);
  if (!papel || (papel === "vendedor" && !vslug)) {
    return NextResponse.json({ ok: false, error: "Acesso não configurado. Fale com o administrador." }, { status: 403 });
  }
  if (!(await gravarSenha(email, await hashSenha(senha)))) {
    return NextResponse.json({ ok: false, error: "Não consegui salvar agora. Peça um novo link e tente de novo." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, redirect: papel === "vendedor" ? "/prioridades" : "/" });
  res.cookies.set(COOKIE_NAME, await signToken(email, papel, vslug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
