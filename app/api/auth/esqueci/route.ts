import { NextResponse } from "next/server";
import { criarMagicToken, emailAutorizado, enviarLinkSenha, normalizarEmail } from "@/lib/magiclink";
import { appBaseUrl, clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/esqueci  { email }
// "Esqueci a senha" e também "criar minha senha" (primeira vez): manda por e-mail um link para escolher a senha.
// Resposta SEMPRE genérica (não revela se o e-mail tem acesso).
export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = normalizarEmail(body.email);
  } catch {
    // corpo inválido -> resposta genérica
  }
  const generico = NextResponse.json({ ok: true });

  if (await rateLimited(`esqueciip:${clientIp(req)}`, 20, 900)) return generico;
  if (!email || !email.includes("@") || email.length > 200) return generico;
  if (!(await emailAutorizado(email))) return generico;
  if (await rateLimited(`esqueci:${email}`, 3, 900)) return generico;

  const raw = await criarMagicToken(email, "senha");
  if (!raw) return generico;
  await enviarLinkSenha(email, `${appBaseUrl()}/redefinir-senha?token=${raw}`);
  return generico;
}
