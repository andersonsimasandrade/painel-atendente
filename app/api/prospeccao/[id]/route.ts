import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { getClient } from "@/lib/db";
import { soDigitos } from "@/lib/telefone";
import { TEXTO_APRESENTACAO, enfileirarResposta } from "@/lib/prospeccao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = ["fila", "aguardando", "respondeu", "parceiro", "recusou", "encerrado", "sem_telefone", "so_presencial", "silenciado"];

// POST /api/prospeccao/<id> { status?, telefone?, observacao?, parceiro_codigo? } — ajustes manuais (só admin).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Item inválido." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { status?: string; telefone?: string; observacao?: string; parceiro_codigo?: string; acao?: string; texto?: string };
  if (b.acao === "apresentacao" || b.acao === "responder") {
    const texto = b.acao === "apresentacao" ? TEXTO_APRESENTACAO : String(b.texto ?? "").trim();
    if (!texto) return NextResponse.json({ ok: false, error: "Texto vazio." }, { status: 400 });
    const ok = await enfileirarResposta(id, texto);
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: "Não consegui colocar na fila." }, { status: ok ? 200 : 500 });
  }
  const up: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return NextResponse.json({ ok: false, error: "Status inválido." }, { status: 400 });
    up.status = b.status;
    if (b.status === "fila") Object.assign(up, { passo: 0, proximo_em: null, ultimo_envio_em: null });
    if (b.status === "recusou" || b.status === "parceiro" || b.status === "encerrado") up.proximo_em = null;
  }
  if (b.telefone !== undefined) {
    let d = soDigitos(b.telefone);
    if (d.length === 10 || d.length === 11) d = "55" + d;
    if (!/^55\d{10,11}$/.test(d)) return NextResponse.json({ ok: false, error: "Telefone inválido (use DDD + número)." }, { status: 400 });
    up.telefone = d;
    up.telefone_original = b.telefone.slice(0, 30);
    if (b.status === undefined) up.status = "fila";
  }
  if (b.observacao !== undefined) up.observacao = b.observacao.slice(0, 500);
  if (b.parceiro_codigo !== undefined) up.parceiro_codigo = b.parceiro_codigo.slice(0, 60);
  if (!Object.keys(up).length) return NextResponse.json({ ok: false, error: "Nada para alterar." }, { status: 400 });
  const r = await getClient().from("prospeccao").update(up).eq("id", id);
  if (r.error) return NextResponse.json({ ok: false, error: "Não consegui salvar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
