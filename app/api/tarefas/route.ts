import { NextResponse } from "next/server";
import { barrarSemSessao } from "@/lib/ig-dados";
import { criarTarefa, listarTarefas, TIPOS, type CanalTarefa, type TipoTarefa } from "@/lib/tarefas";
import { normalizarWhatsapp } from "@/lib/ig-ligacao";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  return NextResponse.json({ ok: true, tarefas: await listarTarefas() });
}

// POST /api/tarefas — cria uma tarefa manual (fica "sugerida" até você aprovar).
export async function POST(req: Request) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const tipo = String(b.tipo ?? "manual") as TipoTarefa;
  if (!(tipo in TIPOS)) return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
  const canal = String(b.canal ?? "whatsapp") as CanalTarefa;
  if (!["whatsapp", "instagram", "ligacao", "presencial"].includes(canal)) {
    return NextResponse.json({ ok: false, error: "Canal inválido." }, { status: 400 });
  }
  const quando = new Date(String(b.devida_em ?? ""));
  if (Number.isNaN(quando.getTime())) return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });

  let telefone: string | null = null;
  let ig_id: string | null = null;
  let nome = String(b.nome ?? "").trim() || null;
  if (b.ig_id) ig_id = String(b.ig_id).replace(/\D/g, "") || null;
  if (b.telefone) telefone = normalizarWhatsapp(String(b.telefone)) ?? (String(b.telefone).replace(/\D/g, "") || null);
  if (!telefone && !ig_id) {
    return NextResponse.json({ ok: false, error: "Escolha o paciente (busque pelo nome ou número)." }, { status: 400 });
  }
  if (telefone && !nome) {
    const r = await getClient().from("ff_contatos").select("nome").eq("telefone", telefone).limit(1);
    nome = ((r.data ?? [])[0] as { nome: string | null } | undefined)?.nome ?? null;
  }
  const id = await criarTarefa({
    telefone,
    ig_id,
    nome,
    tipo,
    origem: "manual",
    titulo: String(b.titulo ?? "").trim() || undefined,
    motivo: String(b.motivo ?? "").trim() || null,
    canal: canal === "whatsapp" && !telefone && ig_id ? "instagram" : canal,
    mensagem: b.mensagem ? String(b.mensagem).slice(0, 2000) : undefined,
    devida_em: quando,
  });
  if (!id) return NextResponse.json({ ok: false, error: "Não consegui criar." }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
