import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { excluirExercicio, salvarExercicio } from "@/lib/exercicios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH → edita o exercício · DELETE → apaga da biblioteca (os planos já enviados não mudam). Só logado.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await salvarExercicio(b, params.id);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const r = await excluirExercicio(params.id);
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
