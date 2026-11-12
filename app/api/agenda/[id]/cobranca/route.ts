import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cobrarSessaoManual } from "@/lib/pos-agendamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST → gera (ou reenvia) o link de pagamento da sessão pelo WhatsApp. Só logado e só do próprio escopo.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const id = String(params.id ?? "").trim();
  const r = await getClient().from("agendamentos").select("telefone_lead").eq("id", id).limit(1);
  const tel = (r.data?.[0] as { telefone_lead?: string } | undefined)?.telefone_lead;
  if (!tel) return NextResponse.json({ ok: false, error: "Sessão não encontrada." }, { status: 404 });
  const barrado = await barrarSeNaoPode(tel);
  if (barrado) return barrado;
  const res = await cobrarSessaoManual(id);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
