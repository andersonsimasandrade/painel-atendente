import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { tratarEventoAsaas } from "@/lib/asaas";
import { destinatariosAlerta } from "@/lib/config";
import { enviarTextoInstancia } from "@/lib/evolution";
import { getClient } from "@/lib/db";
import { variantesTelefone } from "@/lib/telefone";
import { processarRecibo } from "@/lib/recibo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook do Asaas (pública, mas só aceita quem manda o token combinado em ASAAS_WEBHOOK_TOKEN). Marca a cobrança como paga e avisa o Anderson.
export async function POST(req: Request) {
  const esperado = (process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim();
  const recebido = (req.headers.get("asaas-access-token") ?? "").trim();
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  if (!esperado || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401 });

  const corpo = (await req.json().catch(() => ({}))) as { event?: string; payment?: { id?: string; status?: string } };
  try {
    const r = await tratarEventoAsaas(corpo);
    if (r?.pago && r.agendamentoId) await processarRecibo(r.agendamentoId).catch(() => undefined); // sessão já realizada e paga agora: o recibo segue
    if (r?.pago && r.telefone) {
      const c = await getClient().from("ff_contatos").select("nome").in("telefone", variantesTelefone(r.telefone)).limit(1);
      const nome = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? "").trim() || r.telefone;
      const instancia = (process.env.EVOLUTION_INSTANCE ?? "").trim();
      const valor = (r.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (instancia) for (const d of destinatariosAlerta()) if (d.whatsapp) await enviarTextoInstancia(instancia, d.whatsapp, `💰 Pagamento recebido: ${nome} · ${valor}`).catch(() => undefined);
    }
  } catch (e) {
    console.error("[asaas/webhook]", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true }); // sempre 200 para o Asaas não pausar a fila
}
