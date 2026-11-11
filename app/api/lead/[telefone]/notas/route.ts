import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { getSessao } from "@/lib/session";
import { addNota, getNotas, removeNota } from "@/lib/db";
import { registrarObservacaoNaEvolucao } from "@/lib/prontuario";

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
  let agendamentoId: string | null = null;
  let dataSessao: string | null = null;
  let naEvolucao = false;
  try {
    const b = (await req.json()) as { texto?: unknown; agendamento_id?: unknown; data_sessao?: unknown; registrar_evolucao?: unknown };
    texto = String(b.texto ?? "");
    agendamentoId = typeof b.agendamento_id === "string" && b.agendamento_id ? b.agendamento_id : null;
    dataSessao = typeof b.data_sessao === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.data_sessao) ? b.data_sessao : null;
    naEvolucao = b.registrar_evolucao === true;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const sess = await getSessao();
  const r = await addNota(telefone, autorDaSessao(sess), texto, { agendamentoId, dataSessao });
  if (!r.ok) {
    return NextResponse.json(r, { status: r.error === "Escreva a anotação." ? 400 : 500 });
  }
  // Anotação da sessão: também entra na evolução dessa sessão, no prontuário.
  let evolucao: { ok: boolean; error?: string } | undefined;
  if (naEvolucao && dataSessao) evolucao = await registrarObservacaoNaEvolucao(telefone, agendamentoId, dataSessao, texto);
  if (evolucao && !evolucao.ok) return NextResponse.json({ ok: true, notas: await getNotas(telefone), aviso: `A anotação foi salva, mas não entrou na evolução: ${evolucao.error}` });
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
