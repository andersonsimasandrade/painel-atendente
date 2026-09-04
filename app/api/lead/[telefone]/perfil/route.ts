import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { setPerfilManual } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/perfil  { perfil }
// Categoria do lead ajustada pelo operador. "" = Indefinido.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let perfil = "";
  try {
    const b = (await req.json()) as { perfil?: unknown };
    perfil = String(b.perfil ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setPerfilManual(telefone, perfil);
  if (!r.ok) {
    const status =
      r.error === "Lead não encontrado." ? 404 : r.error === "Categoria inválida." ? 400 : 500;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json({ ok: true, perfil });
}
