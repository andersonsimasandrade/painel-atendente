import { NextResponse } from "next/server";
import { criarMagicToken, emailAutorizado, enviarMagicLink, normalizarEmail } from "@/lib/magiclink";
import { appBaseUrl, clientIp, safePath } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/request-link  { email, from? }
// Envia um magic link se o e-mail estiver autorizado. Resposta SEMPRE genérica
// (não revela se o e-mail existe/está autorizado — evita enumeração).
export async function POST(req: Request) {
  let email = "";
  let from = "/";
  try {
    const body = (await req.json()) as { email?: unknown; from?: unknown };
    email = normalizarEmail(body.email);
    from = safePath(body.from);
  } catch {
    // corpo inválido -> resposta genérica
  }

  const generico = NextResponse.json({ ok: true });

  // Rate limit por IP (cap de volume geral do endpoint).
  if (await rateLimited(`linkip:${clientIp(req)}`, 20, 900)) return generico;

  if (!email || !email.includes("@") || email.length > 200) return generico;
  if (!(await emailAutorizado(email))) return generico;

  // Cooldown por e-mail: no máx. 3 links a cada 15 min (evita e-mail bombing
  // dos usuários reais).
  if (await rateLimited(`link:${email}`, 3, 900)) return generico;

  const raw = await criarMagicToken(email);
  if (!raw) return generico;

  const link = `${appBaseUrl()}/api/auth/verify?token=${raw}&from=${encodeURIComponent(from)}`;
  await enviarMagicLink(email, link); // erro não vaza pro cliente (fica no log)
  return generico;
}
