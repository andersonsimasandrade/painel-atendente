import { NextResponse } from "next/server";
import { barrarSemSessao } from "@/lib/ig-dados";
import { ligarInstagramAoWhatsApp } from "@/lib/ig-ligacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/instagram/ligar { id, whatsapp } — liga a conversa do Instagram ao WhatsApp da mesma pessoa.
export async function POST(req: Request) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  let id = "";
  let whatsapp = "";
  try {
    const b = (await req.json()) as { id?: unknown; whatsapp?: unknown };
    id = String(b.id ?? "").replace(/\D/g, "");
    whatsapp = String(b.whatsapp ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!id || !whatsapp) return NextResponse.json({ ok: false, error: "Informe o WhatsApp." }, { status: 400 });
  const r = await ligarInstagramAoWhatsApp(id, whatsapp);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
