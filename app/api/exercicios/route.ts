import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { listarExercicios, salvarExercicio } from "@/lib/exercicios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Biblioteca de exercícios do Anderson. Só logado.
//   GET  → lista (inclui os inativos)
//   POST → cria um exercício
export async function GET() {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ ok: true, exercicios: await listarExercicios(true) });
}

export async function POST(req: Request) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await salvarExercicio(b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
