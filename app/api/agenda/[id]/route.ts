import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { enviarTextoInstancia } from "@/lib/evolution";
import { textoConfirmacao } from "@/lib/confirmacao";
import { formatarBR } from "@/lib/slots";
import { CONSULTORIOS } from "@/lib/site";
import { cancelarAgendamento, getCompromissos, getVendedorBySlug, marcarAvisoNoHistorico, remarcarAgendamento } from "@/lib/agenda";
import { avisoDeslocamento, conflitoDeslocamento } from "@/lib/deslocamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/agenda/[id]
//   { data: "AAAA-MM-DD", hora: "HH:MM", local: "capoeiras"|"centro" } → REMARCAR (muda também no Google Agenda)
//   { cancelar: true }                                                 → CANCELAR (some do Google Agenda)
// Consultor (papel vendedor) só mexe na própria agenda.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  let vendedorId: string | undefined;
  if (sess.papel === "vendedor") {
    const v = sess.vslug ? await getVendedorBySlug(sess.vslug) : null;
    if (!v) return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    vendedorId = v.id;
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const id = String(params.id ?? "").trim();

  if (b.cancelar === true) {
    const antes = await getClient().from("agendamentos").select("telefone_lead, nome_lead, data_hora, local, status, vendedor_id").eq("id", id).limit(1);
    const era = antes.data?.[0] as { telefone_lead: string; nome_lead: string | null; data_hora: string; local: string | null; status: string; vendedor_id: string } | undefined;
    const r = await cancelarAgendamento(id, vendedorId);
    if (!r.ok) return NextResponse.json(r, { status: r.error === "Agendamento não encontrado." ? 404 : 500 });

    // Aviso de desmarcação ao paciente: deixa registrado e evita mal-entendidos.
    let avisos: { cancelamento: boolean } | undefined;
    if (b.avisar !== false && era && (era.status === "agendado" || era.status === "confirmado")) {
      avisos = { cancelamento: false };
      try {
        const v = await getClient().from("vendedores").select("instancia_whatsapp").eq("id", era.vendedor_id).limit(1);
        const instancia = ((v.data?.[0] as { instancia_whatsapp?: string } | undefined)?.instancia_whatsapp ?? process.env.EVOLUTION_INSTANCE ?? "").trim();
        if (instancia) {
          const primeiro = era.nome_lead ? era.nome_lead.trim().split(/\s+/)[0] : "";
          const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
          const onde = era.local === "capoeiras" || era.local === "centro" ? ` (${CONSULTORIOS[era.local].bairro})` : "";
          const msg = `${ola} Passando para avisar que a sua consulta de *${formatarBR(era.data_hora)}*${onde} foi desmarcada. 😊\nQuando quiser marcar um novo horário, é só me avisar por aqui.`;
          const e = await enviarTextoInstancia(instancia, era.telefone_lead, msg);
          avisos.cancelamento = e.ok;
          if (e.ok) {
            await getClient()
              .from("n8n_chat_histories")
              .insert({ session_id: era.telefone_lead, message: { type: "ai", content: msg, tool_calls: [], additional_kwargs: { via: "sistema" }, response_metadata: {}, invalid_tool_calls: [] } })
              .then(undefined, () => undefined);
          }
        }
      } catch (e) {
        console.error("[agenda/cancelar] aviso ao paciente:", e instanceof Error ? e.message : e);
      }
      await marcarAvisoNoHistorico(id, avisos.cancelamento, "cancelado");
    }
    return NextResponse.json({ ok: true, avisos });
  }

  const data = String(b.data ?? "");
  const hora = String(b.hora ?? "");
  const local = b.local === "capoeiras" || b.local === "centro" ? b.local : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora) || !local) {
    return NextResponse.json({ ok: false, error: "Informe dia, horário e consultório." }, { status: 400 });
  }
  const iso = new Date(`${data}T${hora}:00-03:00`);
  if (!Number.isFinite(iso.getTime())) return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });

  // Deslocamento entre consultórios: só AVISA (o Anderson decide), nunca bloqueia.
  let aviso: string | undefined;
  try {
    const atual = await getClient().from("agendamentos").select("vendedor_id").eq("id", id).limit(1);
    const dono = (atual.data?.[0] as { vendedor_id?: string } | undefined)?.vendedor_id;
    if (dono) {
      const choque = conflitoDeslocamento(iso.getTime(), local, await getCompromissos(dono, id));
      aviso = [choque ? avisoDeslocamento(choque, local) : "", local === "centro" ? "Lembre de reservar a sala no Centro." : ""].filter(Boolean).join(" ") || undefined;
    }
  } catch {
    /* o aviso é um extra: não impede remarcar */
  }

  // Como estava antes (para o aviso de cancelamento do horário antigo).
  const antes = await getClient()
    .from("agendamentos")
    .select("telefone_lead, nome_lead, data_hora, local, status, vendedor_id")
    .eq("id", id)
    .limit(1);
  const velho = antes.data?.[0] as { telefone_lead: string; nome_lead: string | null; data_hora: string; local: string | null; status: string; vendedor_id: string } | undefined;

  const r = await remarcarAgendamento(id, iso.toISOString(), local, vendedorId);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.conflito ? "Já existe uma consulta nesse horário." : r.error },
      { status: r.conflito ? 409 : r.error === "Agendamento não encontrado." ? 404 : 500 },
    );
  }

  // Avisos ao paciente pelo WhatsApp: (1) o horário antigo foi cancelado; (2) confirmação da nova data, com local e horário.
  // O lembrete do dia da consulta (3h antes) já é reprogramado pela remarcação para o novo horário.
  let avisos: { cancelamento: boolean; confirmacao: boolean } | undefined;
  const mudou = !!velho && (new Date(velho.data_hora).getTime() !== iso.getTime() || velho.local !== local);
  if (b.avisar !== false && velho && mudou && (velho.status === "agendado" || velho.status === "confirmado")) {
    avisos = { cancelamento: false, confirmacao: false };
    try {
      const v = await getClient().from("vendedores").select("instancia_whatsapp").eq("id", velho.vendedor_id).limit(1);
      const instancia = ((v.data?.[0] as { instancia_whatsapp?: string } | undefined)?.instancia_whatsapp ?? process.env.EVOLUTION_INSTANCE ?? "").trim();
      if (instancia) {
        const primeiro = velho.nome_lead ? velho.nome_lead.trim().split(/\s+/)[0] : "";
        const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
        const velhoLocal = velho.local === "capoeiras" || velho.local === "centro" ? ` (${CONSULTORIOS[velho.local].bairro})` : "";
        const msgCancela = `${ola} Passando para avisar que a sua consulta de *${formatarBR(velho.data_hora)}*${velhoLocal} foi cancelada, porque o horário foi alterado. Já te envio a confirmação do novo horário. 😊`;
        const msgNova = textoConfirmacao({ nome: velho.nome_lead, iso: iso.toISOString(), local, primeiraVez: false, remarcada: true });
        const e1 = await enviarTextoInstancia(instancia, velho.telefone_lead, msgCancela);
        avisos.cancelamento = e1.ok;
        if (e1.ok) await new Promise((res) => setTimeout(res, 1500)); // mantém a ordem das duas mensagens
        const e2 = await enviarTextoInstancia(instancia, velho.telefone_lead, msgNova);
        avisos.confirmacao = e2.ok;
        // memória da conversa (o robô sabe o que foi dito ao paciente)
        for (const [ok, texto] of [[e1.ok, msgCancela], [e2.ok, msgNova]] as const) {
          if (!ok) continue;
          await getClient()
            .from("n8n_chat_histories")
            .insert({ session_id: velho.telefone_lead, message: { type: "ai", content: texto, tool_calls: [], additional_kwargs: { via: "sistema" }, response_metadata: {}, invalid_tool_calls: [] } })
            .then(undefined, () => undefined);
        }
      }
    } catch (e) {
      console.error("[agenda/remarcar] avisos ao paciente:", e instanceof Error ? e.message : e);
    }
  }
  if (avisos) await marcarAvisoNoHistorico(id, avisos.cancelamento && avisos.confirmacao);
  return NextResponse.json({ ok: true, aviso, avisos });
}
