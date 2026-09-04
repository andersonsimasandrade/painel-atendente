import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { inserirMensagemPainel } from "@/lib/db";
import { enviarAudioWhatsApp } from "@/lib/evolution";
import { canalDaConversa } from "@/lib/consultores";
import { chamarPausaWebhook } from "@/lib/painel-pausa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~4M chars de base64 ≈ 3MB — sob o limite de ~4.5MB de corpo da Vercel.
const MAX_B64 = 4_000_000;

// POST /api/conversa/[telefone]/enviar-audio  { audioBase64 }
// Envia uma nota de voz pelo WhatsApp (Evolution) e registra um marcador na
// conversa. Mesmo fluxo do /enviar: pausa o bot, envia, registra.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só age sobre lead DELE. 403 caso contrário.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let audioBase64 = "";
  try {
    const body = (await req.json()) as { audioBase64?: unknown };
    audioBase64 = String(body.audioBase64 ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!audioBase64) {
    return NextResponse.json({ ok: false, error: "Áudio vazio." }, { status: 400 });
  }
  if (audioBase64.length > MAX_B64) {
    return NextResponse.json(
      { ok: false, error: "Áudio muito grande — grave uma nota mais curta." },
      { status: 400 },
    );
  }

  const pausa = await chamarPausaWebhook(telefone, "pause");
  // Sai pelo número que atende este lead, não pela instância do env.
  const canal = await canalDaConversa(telefone);
  const envio = await enviarAudioWhatsApp(telefone, audioBase64, canal.instancia);
  if (!envio.ok) {
    return NextResponse.json(
      { ok: false, error: envio.error ?? "Falha ao enviar o áudio.", pausa: pausa.ok },
      { status: 502 },
    );
  }

  const marcador = "🎤 Áudio";
  const rec = await inserirMensagemPainel(telefone, marcador);
  if (!rec.ok) console.error("[/enviar-audio] falha ao registrar marcador:", rec.error);

  return NextResponse.json({
    ok: true,
    pausa: pausa.ok,
    persisted: rec.ok,
    message: {
      ...(rec.ok && rec.id != null ? { id: rec.id } : {}),
      autor: "ia" as const,
      via: "painel" as const,
      texto: marcador,
    },
  });
}
