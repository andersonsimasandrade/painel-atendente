import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { setResultadoLead } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/resultado  { resultado, motivo }
// Concluir atendimento: qualquer chave de RESULTADO_ORDER (lib/theme) + motivo.
// resultado vazio/null = desfazer (volta a "em andamento").
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  let resultado: string | null = null;
  let motivo = "";
  try {
    const b = (await req.json()) as { resultado?: unknown; motivo?: unknown };
    resultado = b.resultado == null ? null : String(b.resultado).trim() || null;
    motivo = String(b.motivo ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await setResultadoLead(telefone, resultado, motivo);
  if (!r.ok) {
    const status =
      r.error === "Lead não encontrado." ? 404 : r.error === "Desfecho inválido." ? 400 : 500;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json({ ok: true });
}
