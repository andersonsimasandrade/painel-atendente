import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { ativarDevolutiva, criarDevolutiva, excluirDevolutiva, marcarDevolutivaEnviada } from "@/lib/devolutivas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Devolutiva do caso. Só logado e só do próprio escopo.
//   POST   { titulo, relato, exames[], achados, plano, observacoes, mostrar_dor, prescricao_id } → cria e devolve o código do link
//   PATCH  { id, ativa?: boolean, enviada?: true }
//   DELETE ?id=…
const tel = (p: { telefone: string }) => decodeURIComponent(p.telefone ?? "").trim();

export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await criarDevolutiva(t, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function PATCH(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { id?: string; ativa?: boolean; enviada?: boolean };
  const id = String(b.id ?? "");
  if (b.enviada === true) {
    await marcarDevolutivaEnviada(t, id);
    return NextResponse.json({ ok: true });
  }
  if (typeof b.ativa === "boolean") {
    const r = await ativarDevolutiva(t, id, b.ativa);
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  }
  return NextResponse.json({ ok: false, error: "Nada para alterar." }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const r = await excluirDevolutiva(t, new URL(req.url).searchParams.get("id") ?? "");
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
