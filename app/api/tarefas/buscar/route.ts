import { NextResponse } from "next/server";
import { barrarSemSessao } from "@/lib/ig-dados";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tarefas/buscar?q= — acha paciente (WhatsApp) por nome ou número, e conversas do Instagram, para criar tarefa.
export async function GET(req: Request) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");
  if (q.length < 2) return NextResponse.json({ ok: true, resultados: [] });
  const sb = getClient();
  const digitos = q.replace(/\D/g, "");
  const filtroWa = digitos.length >= 4 ? `telefone.ilike.%${digitos}%,nome.ilike.%${q}%` : `nome.ilike.%${q}%`;
  const [wa, ig] = await Promise.all([
    sb.from("ff_contatos").select("telefone, nome, ig_id").or(filtroWa).order("ultima_interacao", { ascending: false }).limit(8),
    sb.from("ig_contatos").select("ig_id, nome, username, telefone").or(`nome.ilike.%${q}%,username.ilike.%${q}%`).limit(6),
  ]);
  const resultados = [
    ...((wa.data ?? []) as { telefone: string; nome: string | null; ig_id: string | null }[]).map((c) => ({
      rotulo: `${c.nome ?? "Sem nome"} · WhatsApp ${c.telefone}`,
      telefone: c.telefone as string | null,
      ig_id: c.ig_id,
      nome: c.nome,
    })),
    ...((ig.data ?? []) as { ig_id: string; nome: string | null; username: string | null; telefone: string | null }[])
      .filter((c) => !c.telefone)
      .map((c) => ({
        rotulo: `${c.nome ?? c.username ?? "Instagram"} · Instagram${c.username ? " @" + c.username : ""}`,
        telefone: null as string | null,
        ig_id: c.ig_id as string | null,
        nome: c.nome ?? c.username,
      })),
  ];
  return NextResponse.json({ ok: true, resultados });
}
