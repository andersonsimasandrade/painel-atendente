import { NextResponse } from "next/server";
import { cookieDevolutiva, criarToken, limparFalhas, minutosBloqueado, nascimentoIso, registrarFalha, VALIDADE_COOKIE_S } from "@/lib/devolutiva-acesso";
import { dadosDeAcesso } from "@/lib/devolutivas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pública (site): o paciente digita a data de nascimento para abrir a devolutiva. Acertou → cookie assinado deste documento.
export async function POST(req: Request, { params }: { params: { codigo: string } }) {
  const codigo = String(params.codigo ?? "");
  const espera = minutosBloqueado(codigo);
  if (espera > 0) {
    return NextResponse.json({ ok: false, error: `Muitas tentativas. Tente de novo em ${espera} min ou fale com o Anderson pelo WhatsApp.` }, { status: 429 });
  }
  const b = (await req.json().catch(() => ({}))) as { nascimento?: string };
  const info = await dadosDeAcesso(codigo);
  if (!info || !info.nascimento) return NextResponse.json({ ok: false, error: "Este documento não está disponível. Fale com o Anderson pelo WhatsApp." }, { status: 404 });

  const digitado = nascimentoIso(String(b.nascimento ?? ""));
  if (!digitado || digitado !== info.nascimento) {
    registrarFalha(codigo);
    return NextResponse.json({ ok: false, error: "A data não confere. Confira dia, mês e ano." }, { status: 401 });
  }
  limparFalhas(codigo);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: cookieDevolutiva(codigo),
    value: criarToken(codigo),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/devolutiva/${codigo}`,
    maxAge: VALIDADE_COOKIE_S,
  });
  return res;
}
