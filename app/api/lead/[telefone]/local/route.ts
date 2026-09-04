import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { setLocalLead } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/local  { cidade, uf }
// Cidade/UF preenchidas à mão no painel (quando a IA não pegou da conversa).
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let cidade = "";
  let uf = "";
  try {
    const b = (await req.json()) as { cidade?: unknown; uf?: unknown };
    cidade = String(b.cidade ?? "");
    uf = String(b.uf ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setLocalLead(telefone, cidade, uf);
  if (!r.ok) {
    const status = r.error === "Lead não encontrado." ? 404 : r.error?.startsWith("UF") ? 400 : 500;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json({ ok: true });
}
