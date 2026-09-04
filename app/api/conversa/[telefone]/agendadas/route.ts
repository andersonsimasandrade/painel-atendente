import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { getSessao } from "@/lib/session";
import { cancelarAgendada, criarAgendada, listarAgendadas } from "@/lib/agendadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorDaSessao(sess: { papel: string; vslug?: string } | null): string {
  const slug = sess?.vslug?.trim();
  if (slug) return slug.charAt(0).toUpperCase() + slug.slice(1);
  return "Gestão";
}

// GET — mensagens agendadas PENDENTES desta conversa.
export async function GET(_req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  return NextResponse.json({ ok: true, agendadas: await listarAgendadas(telefone) });
}

// POST { texto, quando } — agenda uma mensagem (quando = ISO).
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;

  let texto = "";
  let quando = "";
  try {
    const b = (await req.json()) as { texto?: unknown; quando?: unknown };
    texto = String(b.texto ?? "");
    quando = String(b.quando ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const sess = await getSessao();
  const r = await criarAgendada(telefone, texto, quando, autorDaSessao(sess));
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, agendadas: await listarAgendadas(telefone) });
}

// DELETE { id } — cancela um agendamento pendente.
export async function DELETE(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;

  let id = 0;
  try {
    const b = (await req.json()) as { id?: unknown };
    id = Number(b.id);
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await cancelarAgendada(telefone, id);
  if (!r.ok) {
    return NextResponse.json(r, {
      status: r.error?.startsWith("Agendamento não") ? 404 : 400,
    });
  }
  return NextResponse.json({ ok: true, agendadas: await listarAgendadas(telefone) });
}
