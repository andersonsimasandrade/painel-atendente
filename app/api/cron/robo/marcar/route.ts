import { NextResponse } from "next/server";
import { marcarPeloRobo } from "@/lib/marcar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/robo/marcar { telefone, nome, data, hora, local } (Bearer CRON_SECRET)
// O robô marca a consulta de verdade: confere se o horário está livre, grava na agenda, avança o funil,
// manda a confirmação completa ao paciente e avisa o Anderson.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const local = b.local === "centro" ? "centro" : b.local === "capoeiras" ? "capoeiras" : null;
  if (!local) return NextResponse.json({ ok: false, error: "Consultório inválido." }, { status: 400 });
  const r = await marcarPeloRobo({
    telefone: String(b.telefone ?? ""),
    nome: String(b.nome ?? "").trim().slice(0, 120) || null,
    data: String(b.data ?? ""),
    hora: String(b.hora ?? ""),
    local,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : r.conflito ? 409 : 400 });
}
