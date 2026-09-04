import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { marcarPresenca, getVendedorBySlug } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { id, presenca } — presenca ∈ {compareceu, faltou, agendado(=desfazer)}.
// Protegida pelo cookie de sessão. Vendedor só marca presença na PRÓPRIA agenda.
export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  let id = "";
  let presenca = "";
  try {
    const b = (await req.json()) as { id?: unknown; presenca?: unknown };
    id = String(b.id ?? "").trim();
    presenca = String(b.presenca ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  // Escopo do vendedor: resolve o vendedor_id p/ o UPDATE só casar as reuniões dele.
  let vendedorId: string | undefined;
  if (sess.papel === "vendedor") {
    if (!sess.vslug) {
      return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    }
    const v = await getVendedorBySlug(sess.vslug);
    if (!v) return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    vendedorId = v.id;
  }

  const res = await marcarPresenca(id, presenca, vendedorId);
  if (!res.ok) {
    const status = res.error === "Agendamento não encontrado." ? 404 : 400;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json({ ok: true });
}
