import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { addRespostaRapida, getRespostasRapidas, removeRespostaRapida } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function autorizado(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

// GET /api/respostas-rapidas — lista os atalhos.
export async function GET() {
  if (!(await autorizado())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const respostas = await getRespostasRapidas();
  return NextResponse.json({ ok: true, respostas });
}

// POST /api/respostas-rapidas  { titulo, corpo } — cria um atalho.
export async function POST(req: Request) {
  if (!(await autorizado())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  let titulo = "";
  let corpo = "";
  try {
    const body = (await req.json()) as { titulo?: unknown; corpo?: unknown };
    titulo = String(body.titulo ?? "").trim();
    corpo = String(body.corpo ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!titulo || !corpo) {
    return NextResponse.json({ ok: false, error: "Título e mensagem são obrigatórios." }, { status: 400 });
  }
  const r = await addRespostaRapida(titulo, corpo);
  if (!r.ok) return NextResponse.json(r, { status: 500 });
  return NextResponse.json({ ok: true, resposta: r.resposta });
}

// DELETE /api/respostas-rapidas?id=... — remove um atalho.
export async function DELETE(req: Request) {
  if (!(await autorizado())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "id obrigatório." }, { status: 400 });
  const r = await removeRespostaRapida(id);
  if (!r.ok) return NextResponse.json(r, { status: 500 });
  return NextResponse.json({ ok: true });
}
