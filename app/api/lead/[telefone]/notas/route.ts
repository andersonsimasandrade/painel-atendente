import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { getSessao } from "@/lib/session";
import { addNota, getNotas, removeNota } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autor exibido nas anotações: nome do consultor (slug capitalizado) ou "Gestão".
function autorDaSessao(sess: { papel: string; vslug?: string } | null): string {
  const slug = sess?.vslug?.trim();
  if (slug) return slug.charAt(0).toUpperCase() + slug.slice(1);
  return "Gestão";
}

// GET /api/lead/[telefone]/notas — lista as anotações manuais do lead.
export async function GET(_req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  return NextResponse.json({ ok: true, notas: await getNotas(telefone) });
}

// POST /api/lead/[telefone]/notas  { texto } — adiciona uma anotação.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;

  let texto = "";
  try {
    const b = (await req.json()) as { texto?: unknown };
    texto = String(b.texto ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const sess = await getSessao();
  const r = await addNota(telefone, autorDaSessao(sess), texto);
  if (!r.ok) {
    return NextResponse.json(r, { status: r.error === "Escreva a anotação." ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, notas: await getNotas(telefone) });
}

// DELETE /api/lead/[telefone]/notas  { id } — exclui uma anotação do lead.
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

  const r = await removeNota(telefone, id);
  if (!r.ok) {
    return NextResponse.json(r, { status: r.error === "Nota não encontrada." ? 404 : 500 });
  }
  return NextResponse.json({ ok: true, notas: await getNotas(telefone) });
}
