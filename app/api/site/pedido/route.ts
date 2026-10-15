import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getClient } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import {
  CONSULTORIOS,
  DIAS,
  PERIODOS,
  derivarCanal,
  nomeDosDias,
  whatsappNumero,
} from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site/pedido — o visitante do site pediu para agendar.
// Grava as preferências + a origem (Google/Meta/orgânico) sob um CÓDIGO curto e
// devolve o link do WhatsApp com esse código dentro da mensagem. Quando a
// pessoa envia, o robô lê o código e liga a conversa a este registro.
//
// NÃO coleta nenhum dado de saúde nem telefone: o número vem do próprio
// WhatsApp. Por isso a rota não dispara mensagem a ninguém (sem risco de spam).

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem O/0/I/1/L

function gerarCodigo(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return c;
}

function limpa(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return s || null;
}

export async function POST(req: Request) {
  if (await rateLimited(`site-pedido:${clientIp(req)}`, 12, 600)) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  // Honeypot: robôs preenchem; pessoas não veem o campo.
  if (limpa(b.site_url)) {
    return NextResponse.json({ ok: true, url: `https://wa.me/${whatsappNumero()}` });
  }

  const cons = limpa(b.consultorio, 20);
  const consultorio = cons === "capoeiras" || cons === "centro" ? cons : "qualquer";

  const idsDias = DIAS.map((d) => d.id) as string[];
  const dias = (Array.isArray(b.dias) ? b.dias : [])
    .map((x) => String(x))
    .filter((x) => idsDias.includes(x));
  const idsPer = PERIODOS.map((p) => p.id) as string[];
  const periodos = (Array.isArray(b.periodos) ? b.periodos : [])
    .map((x) => String(x))
    .filter((x) => idsPer.includes(x));

  const o = (b.origem && typeof b.origem === "object" ? b.origem : {}) as Record<string, unknown>;
  const origem = {
    gclid: limpa(o.gclid),
    fbclid: limpa(o.fbclid),
    utm_source: limpa(o.utm_source),
    utm_medium: limpa(o.utm_medium),
    utm_campaign: limpa(o.utm_campaign),
    utm_term: limpa(o.utm_term),
    utm_content: limpa(o.utm_content),
    referrer: limpa(o.referrer, 300),
    landing: limpa(o.landing, 100),
  };
  const canal = derivarCanal(origem);

  const supabase = getClient();
  let codigo = "";
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const c = gerarCodigo();
    const { error } = await supabase.from("site_pedidos").insert({
      codigo: c,
      consultorio,
      dias,
      periodos,
      canal,
      ...origem,
    });
    if (!error) {
      codigo = c;
      break;
    }
    // 23505 = código repetido: sorteia outro. Qualquer outro erro: aborta.
    if (error.code !== "23505") {
      console.error("[site/pedido]", error.message);
      return NextResponse.json(
        { ok: false, error: "Não foi possível registrar agora. Tente de novo." },
        { status: 500 },
      );
    }
  }
  if (!codigo) {
    return NextResponse.json({ ok: false, error: "Tente de novo." }, { status: 500 });
  }

  // Mensagem que o paciente vai enviar. O código fica no fim, entre parênteses.
  const partes: string[] = ["Olá! Vim pelo site e quero agendar uma sessão de fisioterapia."];
  partes.push(
    consultorio === "qualquer"
      ? "Consultório: tanto faz (Capoeiras ou Centro)."
      : `Consultório: ${CONSULTORIOS[consultorio].bairro}.`,
  );
  if (dias.length) partes.push(`Dias que posso: ${nomeDosDias(dias)}.`);
  if (periodos.length) {
    const nomes = PERIODOS.filter((p) => periodos.includes(p.id)).map((p) => p.nome.toLowerCase());
    partes.push(`Período: ${nomes.join(" ou ")}.`);
  }
  partes.push(`(código ${codigo})`);

  const url = `https://wa.me/${whatsappNumero()}?text=${encodeURIComponent(partes.join(" "))}`;
  return NextResponse.json({ ok: true, url, codigo });
}
