import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { criarPrescricao, encerrarPrescricao, excluirPrescricao, marcarEnviada } from "@/lib/exercicios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Planos de exercícios do paciente. Só logado e só do próprio escopo.
//   POST   { titulo, orientacoes, itens[] } → cria o plano e devolve o código do link
//   PATCH  { id, ativa?: boolean, enviada?: true } → encerra/reabre o link, ou marca como enviado
//   DELETE ?id=…
const tel = (p: { telefone: string }) => decodeURIComponent(p.telefone ?? "").trim();

export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await criarPrescricao(t, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function PATCH(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { id?: string; ativa?: boolean; enviada?: boolean };
  const id = String(b.id ?? "");
  if (b.enviada === true) {
    await marcarEnviada(t, id);
    return NextResponse.json({ ok: true });
  }
  if (typeof b.ativa === "boolean") {
    const r = await encerrarPrescricao(t, id, b.ativa);
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  }
  return NextResponse.json({ ok: false, error: "Nada para alterar." }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: { telefone: string } }) {
  const t = tel(params);
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const r = await excluirPrescricao(t, new URL(req.url).searchParams.get("id") ?? "");
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
