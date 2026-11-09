import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { excluirEvolucao, salvarEvolucao } from "@/lib/prontuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Evolução por sessão (prontuário). Só logado e só do próprio escopo.
//   POST   { data_sessao, queixa, achados, conduta, plano, dor_inicio, dor_fim, agendamento_id? }
//   DELETE ?id=…
const tel = (p: { telefone: string }) => decodeURIComponent(p.telefone ?? "").trim();

export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await salvarEvolucao(t, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function DELETE(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const r = await excluirEvolucao(t, new URL(req.url).searchParams.get("id") ?? "");
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
