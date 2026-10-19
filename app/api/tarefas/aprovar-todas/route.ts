import { NextResponse } from "next/server";
import { barrarSemSessao } from "@/lib/ig-dados";
import { getClient } from "@/lib/db";
import { checarContexto, fimDoDiaSP, salvarChecagem, type Tarefa } from "@/lib/tarefas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/tarefas/aprovar-todas — aprova as sugeridas de HOJE (e atrasadas) que a checagem diz que ainda fazem sentido.
export async function POST() {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  const sb = getClient();
  const r = await sb.from("tarefas").select("*").eq("status", "sugerida").lte("devida_em", fimDoDiaSP(new Date()).toISOString()).limit(60);
  let aprovadas = 0;
  let aRever = 0;
  for (const t of (r.data ?? []) as Tarefa[]) {
    const ch = await checarContexto(t);
    await salvarChecagem(t.id, ch);
    if (!ch.faz_sentido) {
      aRever++;
      continue;
    }
    await sb.from("tarefas").update({ status: "aprovada", aprovada_em: new Date().toISOString() }).eq("id", t.id);
    aprovadas++;
  }
  return NextResponse.json({ ok: true, aprovadas, aRever });
}
