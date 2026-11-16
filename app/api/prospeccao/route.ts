import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { definirCampanha } from "@/lib/prospeccao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/prospeccao { acao: "ativar" | "pausar" } — liga/desliga o envio automático da campanha (só admin).
export async function POST(req: Request) {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { acao?: string };
  if (b.acao !== "ativar" && b.acao !== "pausar") return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  await definirCampanha(b.acao === "ativar");
  return NextResponse.json({ ok: true });
}
