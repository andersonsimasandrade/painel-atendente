import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { getClient } from "@/lib/db";
import { enviarIndicacao } from "@/lib/indicacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/indicacoes/<id>  { acao: "enviar", texto } | { acao: "descartar" }
// Só admin (o Anderson). "enviar" é o clique único que manda a primeira mensagem ao paciente indicado.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Indicação inválida." }, { status: 400 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  if (b.acao === "descartar") {
    await getClient().from("indicacoes").update({ status: "descartada" }).eq("id", id).in("status", ["aguardando", "pronta"]);
    return NextResponse.json({ ok: true });
  }
  if (b.acao === "enviar") {
    const r = await enviarIndicacao(id, String(b.texto ?? ""));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
}
