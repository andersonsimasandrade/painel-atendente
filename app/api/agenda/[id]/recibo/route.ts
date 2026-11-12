import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { barrarSeNaoPode } from "@/lib/escopo";
import { definirEnviarRecibo, enviarReciboManual } from "@/lib/recibo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { acao: "caixinha", enviar: boolean } → marca se esta sessão terá recibo depois da sessão
// POST { acao: "enviar" }                    → emite e envia o recibo agora (sessão com presença confirmada)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const id = String(params.id ?? "").trim();
  const r = await getClient().from("agendamentos").select("telefone_lead").eq("id", id).limit(1);
  const tel = (r.data?.[0] as { telefone_lead?: string } | undefined)?.telefone_lead;
  if (!tel) return NextResponse.json({ ok: false, error: "Sessão não encontrada." }, { status: 404 });
  const barrado = await barrarSeNaoPode(tel);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { acao?: string; enviar?: boolean };
  const res = b.acao === "caixinha" ? await definirEnviarRecibo(id, b.enviar !== false) : b.acao === "enviar" ? await enviarReciboManual(id) : ({ ok: false, error: "Ação inválida." } as const);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
