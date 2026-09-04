import { NextResponse } from "next/server";
import {
  snapshotDias,
  lerTrafego,
  agregarPeriodo,
  porCampanhaCompleto,
  intervaloPeriodo,
  datasEntre,
  addDias,
  diffDias,
  hojeSP,
  textoWhatsApp,
  htmlEmail,
  type Periodo,
} from "@/lib/trafego";
import { enviarEmail } from "@/lib/email";
import { enviarTextoInstancia } from "@/lib/evolution";
import { destinatariosAlerta, instanciaAlertas, empresaNome } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST/GET /api/cron/trafego?periodo=diario|semanal|mensal[&dry=1]
// Bearer CRON_SECRET. Snapshota os últimos 8 dias (idempotente), compõe o
// relatório do período e envia por e-mail (Resend) + WhatsApp,
// com pausa. `dry=1` NÃO envia — devolve o texto composto (p/ teste).
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const periodo = (url.searchParams.get("periodo") || "diario") as Periodo;
  const dry = url.searchParams.get("dry") === "1";
  if (!["diario", "semanal", "mensal"].includes(periodo)) {
    return NextResponse.json({ ok: false, error: "periodo inválido" }, { status: 400 });
  }

  const hoje = hojeSP();
  const { desde, ate, label } = intervaloPeriodo(periodo, hoje);

  // 1) Snapshot: UNIÃO do período reportado com os últimos 8 dias — faz backfill
  // do mensal/semanal inteiro e cobre o lag de atribuição da Meta (até 7d).
  // dry NÃO grava (preview puro).
  const ontem = addDias(hoje, -1);
  const inicioSnap = desde < addDias(hoje, -8) ? desde : addDias(hoje, -8);
  const snap = dry
    ? { ok: true, gravados: 0, error: undefined as string | undefined }
    : await snapshotDias(datasEntre(inicioSnap, ontem));
  if (!snap.ok) console.error("[cron/trafego] snapshot:", snap.error);

  // 2) Lê o período fechado e agrega.
  const dias = await lerTrafego(desde, ate);
  const m = agregarPeriodo(dias);

  // 3) Compõe. Dias recentes ainda amadurecem (atribuição de 7d) → nota.
  const nota =
    diffDias(ate, hoje) < 7
      ? "Obs.: leads/CPL da Meta dos dias mais recentes são preliminares (atribuição de até 7 dias) e podem subir — valores finais no painel /trafego."
      : undefined;
  const campanhas = await porCampanhaCompleto(m.por_campanha, desde, ate);
  const texto = textoWhatsApp(label, m, nota);
  const html = htmlEmail(label, m, nota, campanhas);
  const subject = `${empresaNome()} · Tráfego — ${label}`;

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      periodo,
      label,
      snapshot: snap,
      resumo: {
        investimento: m.investimento,
        leads_meta: m.leads_meta,
        engajados: m.engajados,
        cac_real: m.cac_real,
        roi: m.roi,
        dias: m.dias.length,
      },
      texto,
    });
  }

  // 4) Envia (email + WhatsApp), com pausa entre envios (evita bloqueio).
  const destinos = destinatariosAlerta();
  if (!destinos.length) {
    return NextResponse.json({
      ok: true,
      periodo,
      enviados: 0,
      aviso: "Nenhum destinatário configurado (defina ALERTAS_EMAIL e/ou ALERTAS_WHATSAPP).",
    });
  }

  const instancia = instanciaAlertas();
  let enviados = 0;
  for (let i = 0; i < destinos.length; i++) {
    const p = destinos[i];
    if (p.email) {
      const em = await enviarEmail(p.email, subject, html);
      if (!em.ok) console.error("[cron/trafego] email", p.email, em.error);
      else enviados++;
      await sleep(1200);
    }
    if (p.whatsapp && instancia) {
      const wa = await enviarTextoInstancia(instancia, p.whatsapp, texto);
      if (!wa.ok) console.error("[cron/trafego] whatsapp", p.whatsapp, wa.error);
      else enviados++;
    }
    if (i < destinos.length - 1) await sleep(1500);
  }

  // Se NINGUÉM recebeu (email+WhatsApp falharam), sinaliza erro pro n8n marcar
  // a execução como falha (senão a falha total ficaria invisível).
  const status = enviados === 0 ? 502 : 200;
  return NextResponse.json(
    { ok: enviados > 0, periodo, label, enviados, snapshot: snap.gravados },
    { status },
  );
}

export const POST = handler;
export const GET = handler;
