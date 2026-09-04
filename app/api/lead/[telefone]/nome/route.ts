import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { setNomeLead } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/nome  { nome }
// Renomeia o contato pelo painel (o humano tem a última palavra sobre o bot).
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só renomeia lead DELE.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let nome = "";
  try {
    const b = (await req.json()) as { nome?: unknown };
    nome = String(b.nome ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setNomeLead(telefone, nome);
  if (!r.ok) {
    return NextResponse.json(r, { status: r.error === "Lead não encontrado." ? 404 : 500 });
  }
  return NextResponse.json({ ok: true, nome: nome.trim().slice(0, 80) });
}
