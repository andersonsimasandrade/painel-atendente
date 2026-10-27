import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { cancelarAgendamento, getVendedorBySlug, remarcarAgendamento } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/agenda/[id]
//   { data: "AAAA-MM-DD", hora: "HH:MM", local: "capoeiras"|"centro" } → REMARCAR (muda também no Google Agenda)
//   { cancelar: true }                                                 → CANCELAR (some do Google Agenda)
// Consultor (papel vendedor) só mexe na própria agenda.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  let vendedorId: string | undefined;
  if (sess.papel === "vendedor") {
    const v = sess.vslug ? await getVendedorBySlug(sess.vslug) : null;
    if (!v) return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    vendedorId = v.id;
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const id = String(params.id ?? "").trim();

  if (b.cancelar === true) {
    const r = await cancelarAgendamento(id, vendedorId);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "Agendamento não encontrado." ? 404 : 500 });
  }

  const data = String(b.data ?? "");
  const hora = String(b.hora ?? "");
  const local = b.local === "capoeiras" || b.local === "centro" ? b.local : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora) || !local) {
    return NextResponse.json({ ok: false, error: "Informe dia, horário e consultório." }, { status: 400 });
  }
  const iso = new Date(`${data}T${hora}:00-03:00`);
  if (!Number.isFinite(iso.getTime())) return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });

  const r = await remarcarAgendamento(id, iso.toISOString(), local, vendedorId);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.conflito ? "Já existe uma consulta nesse horário." : r.error },
      { status: r.conflito ? 409 : r.error === "Agendamento não encontrado." ? 404 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
