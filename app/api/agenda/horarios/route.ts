import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getOcupados, getVendedorBySlug, listarVendedores } from "@/lib/agenda";
import { gerarSlotsDias } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agenda/horarios?dias=21 — horários livres dos próximos dias, pelas regras reais de atendimento
// (segunda em semanas alternadas, terça e quarta das 08:00 às 17:00; quinta e sexta com pausa do meio-dia; sábado de manhã em semanas alternadas).
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const dias = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 21));

  let slug = sess.papel === "vendedor" ? sess.vslug ?? "" : "";
  if (!slug) slug = (await listarVendedores())[0]?.slug ?? "";
  const vend = slug ? await getVendedorBySlug(slug) : null;
  if (!vend) return NextResponse.json({ ok: false, error: "Nenhum consultor ativo." }, { status: 400 });

  const ocupados = await getOcupados(vend.id);
  return NextResponse.json({ ok: true, dias: gerarSlotsDias(vend.disponibilidade, ocupados, { horizonteDias: dias }) });
}
