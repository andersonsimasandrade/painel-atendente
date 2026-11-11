import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { ajustarTexto } from "@/lib/prontuario-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { texto, contexto } → { texto } organizado pela IA (gramática, ortografia, clareza). Só logado. Nada é gravado aqui.
export async function POST(req: Request) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { texto?: string; contexto?: string };
  const r = await ajustarTexto(String(b.texto ?? ""), String(b.contexto ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
