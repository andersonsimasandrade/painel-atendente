import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { inserirMensagemPainel } from "@/lib/db";
import { enviarMidiaWhatsApp, MidiaInput } from "@/lib/evolution";
import { canalDaConversa } from "@/lib/consultores";
import { chamarPausaWebhook } from "@/lib/painel-pausa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~4M chars de base64 ≈ 3MB decodificado — fica sob o limite de ~4.5MB de
// corpo das funções serverless da Vercel (que rejeita antes do handler).
const MAX_B64 = 4_000_000;
const TIPOS: ReadonlyArray<MidiaInput["mediatype"]> = ["image", "document", "video"];

// POST /api/conversa/[telefone]/enviar-midia
//   { media (base64/url), mediatype, mimetype, fileName?, caption? }
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

  let media = "";
  let mediatype: MidiaInput["mediatype"] = "document";
  let mimetype = "";
  let fileName = "";
  let caption = "";
  try {
    const body = (await req.json()) as {
      media?: unknown;
      mediatype?: unknown;
      mimetype?: unknown;
      fileName?: unknown;
      caption?: unknown;
    };
    media = String(body.media ?? "");
    const mt = String(body.mediatype ?? "");
    mediatype = (TIPOS as string[]).includes(mt) ? (mt as MidiaInput["mediatype"]) : "document";
    mimetype = String(body.mimetype ?? "");
    fileName = String(body.fileName ?? "").slice(0, 120);
    caption = String(body.caption ?? "").slice(0, 1000);
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!media) return NextResponse.json({ ok: false, error: "Arquivo vazio." }, { status: 400 });
  if (!mimetype) return NextResponse.json({ ok: false, error: "mimetype obrigatório." }, { status: 400 });
  if (media.length > MAX_B64) {
    return NextResponse.json(
      { ok: false, error: "Arquivo muito grande (máx. ~3MB). Reduza a imagem ou comprima o PDF." },
      { status: 400 },
    );
  }

  const pausa = await chamarPausaWebhook(telefone, "pause");
  // Sai pelo número que atende este lead, não pela instância do env.
  const canal = await canalDaConversa(telefone);
  const envio = await enviarMidiaWhatsApp(
    telefone,
    { media, mediatype, mimetype, fileName, caption },
    canal.instancia,
  );
  if (!envio.ok) {
    return NextResponse.json(
      { ok: false, error: envio.error ?? "Falha ao enviar o arquivo.", pausa: pausa.ok },
      { status: 502 },
    );
  }

  const base =
    mediatype === "image" ? "🖼️ Imagem" : mediatype === "video" ? "🎬 Vídeo" : `📎 ${fileName || "Arquivo"}`;
  const marcador = caption ? `${base} — ${caption}` : base;
  const rec = await inserirMensagemPainel(telefone, marcador);
  if (!rec.ok) console.error("[/enviar-midia] falha ao registrar marcador:", rec.error);

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
