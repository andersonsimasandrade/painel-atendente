import { NextResponse } from "next/server";
import { barrarSemSessao } from "@/lib/ig-dados";
import { checarContexto, executarTarefa, marcar, mensagemPersonalizada, salvarChecagem, tarefaPorId } from "@/lib/tarefas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/tarefas/[id] { acao, ... } — aprovar | enviar_agora | descartar | feito | adiar | editar | checar
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  const id = Number(params.id);
  const t = Number.isFinite(id) ? await tarefaPorId(id) : null;
  if (!t) return NextResponse.json({ ok: false, error: "Tarefa não encontrada." }, { status: 404 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const acao = String(b.acao ?? "");
  const edicao: Record<string, unknown> = {};
  if (typeof b.mensagem === "string") edicao.mensagem = b.mensagem.slice(0, 2000);
  if (typeof b.titulo === "string" && b.titulo.trim()) edicao.titulo = b.titulo.trim().slice(0, 160);
  if (typeof b.devida_em === "string") {
    const d = new Date(b.devida_em);
    if (!Number.isNaN(d.getTime())) edicao.devida_em = d.toISOString();
  }
  const agora = new Date().toISOString();

  switch (acao) {
    case "editar":
      await marcar(id, edicao);
      break;
    case "aprovar":
      await marcar(id, { ...edicao, status: "aprovada", aprovada_em: agora });
      break;
    case "enviar_agora": {
      const atual = { ...t, ...(edicao as object) } as typeof t;
      const ch = await checarContexto(atual);
      await salvarChecagem(id, ch);
      if (!ch.faz_sentido && b.forcar !== true) {
        return NextResponse.json({ ok: false, atencao: true, error: `Antes de enviar: ${ch.resumo}` }, { status: 409 });
      }
      await marcar(id, edicao);
      const e = await executarTarefa(atual);
      if (!e.ok) return NextResponse.json({ ok: false, error: e.erro ?? "Falha no envio." }, { status: 502 });
      await marcar(id, { status: "executada", executada_em: agora, aprovada_em: agora, resultado: "Enviada pelo painel." });
      break;
    }
    case "descartar":
      await marcar(id, { status: "descartada", resultado: typeof b.motivo === "string" ? b.motivo.slice(0, 200) : "Descartada." });
      break;
    case "feito":
      await marcar(id, {
        status: "executada",
        executada_em: agora,
        resultado: typeof b.resultado === "string" && b.resultado.trim() ? b.resultado.trim().slice(0, 300) : "Feita manualmente.",
      });
      break;
    case "adiar": {
      const dias = Number(b.dias);
      const nova =
        Number.isFinite(dias) && dias > 0
          ? new Date(new Date(t.devida_em).getTime() + dias * 86400000).toISOString()
          : (edicao.devida_em as string | undefined);
      if (!nova) return NextResponse.json({ ok: false, error: "Informe os dias ou a nova data." }, { status: 400 });
      await marcar(id, { devida_em: nova, resultado: null });
      break;
    }
    case "refazer_texto": {
      if (!t.telefone) return NextResponse.json({ ok: false, error: "Só funciona para pacientes com WhatsApp." }, { status: 400 });
      const novo = await mensagemPersonalizada(t.telefone, t.nome, t.tipo, t.motivo);
      if (!novo) return NextResponse.json({ ok: false, error: "Não consegui escrever um texto novo agora (sem conversa suficiente ou IA indisponível)." }, { status: 502 });
      await marcar(id, { mensagem: novo });
      return NextResponse.json({ ok: true });
    }
    case "checar": {
      const ch = await checarContexto(t);
      await salvarChecagem(id, ch);
      return NextResponse.json({ ok: true, checagem: ch });
    }
    default:
      return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
