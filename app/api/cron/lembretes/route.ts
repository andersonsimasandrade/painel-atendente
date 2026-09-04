import { NextResponse } from "next/server";
import { getAgendamentosParaLembrete, marcarLembreteEnviado } from "@/lib/agenda";
import { selecionarLembretes, mensagemLembrete, horaSP } from "@/lib/lembretes";
import { enviarTextoInstancia } from "@/lib/evolution";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dispara os lembretes ~3h antes. Chamado de hora em hora por um workflow n8n
// (Schedule → HTTP POST) com header Authorization: Bearer <CRON_SECRET>.
// Idempotente: só pega quem ainda não tem lembrete_enviado_em e marca ao enviar.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const ativos = await getAgendamentosParaLembrete();
  const due = selecionarLembretes(ativos, new Date());

  let enviados = 0;
  for (let i = 0; i < due.length; i++) {
    const a = due[i];
    const texto = mensagemLembrete(a.vendedor_nome, a.nome_lead, a.data_hora);
    const env = await enviarTextoInstancia(a.instancia, a.telefone_lead, texto);
    if (env.ok) {
      enviados++;
      await marcarLembreteEnviado(a.id);
      // Loga no painel (como a confirmação da Fase 1) p/ ficar visível na conversa.
      try {
        await getClient()
          .from("n8n_chat_histories")
          .insert({
            session_id: a.telefone_lead,
            message: {
              type: "ai",
              content: `⏰ Lembrete da reunião das ${horaSP(a.data_hora)} enviado.`,
              tool_calls: [],
              additional_kwargs: { via: "sistema" },
              response_metadata: {},
              invalid_tool_calls: [],
            },
          });
      } catch (e) {
        console.error("[cron/lembretes] log painel:", e);
      }
    } else {
      console.error("[cron/lembretes] envio falhou:", a.id, env.error);
    }
    if (i < due.length - 1) await sleep(1200); // pausa entre envios (evita bloqueio do número)
  }

  return NextResponse.json({ ok: true, enviados, total: due.length });
}

export const POST = handler;
export const GET = handler;
