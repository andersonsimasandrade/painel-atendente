import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { derivarCanal } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site/evento — medição PRÓPRIA do site (sem rastreador de terceiros).
// Recebe eventos anônimos (visita, rolagem, clique em WhatsApp/telefone/mapa...) e
// grava junto com a origem do clique (Google/Meta/UTM). Não guarda IP, nome,
// telefone nem qualquer dado de saúde; o visitante é um sorteio aleatório do
// próprio navegador. Respeita "Não rastrear" (o navegador nem chega a enviar).

const TIPOS = new Set([
  "visita",
  "rolagem_50",
  "rolagem_90",
  "tempo_30s",
  "clique",
  "form_inicio",
  "pedido",
]);
const DESTINOS = new Set(["whatsapp", "telefone", "mapa", "agendar", "instagram", "facebook", "outro"]);

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;

function limpa(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return s || null;
}

function idCurto(v: unknown): string | null {
  const s = limpa(v, 64);
  return s && /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

export async function POST(req: Request) {
  // Robôs e verificadores não entram nas contas.
  if (BOTS.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  if (await rateLimited(`site-evento:${clientIp(req)}`, 150, 600)) return new NextResponse(null, { status: 204 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const visitante = idCurto(b.v);
  const tipo = limpa(b.tipo, 20);
  if (!visitante || !tipo || !TIPOS.has(tipo)) return new NextResponse(null, { status: 204 });

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
  };

  let detalhe: Record<string, unknown> | null = null;
  if (tipo === "clique") {
    const d = (b.detalhe && typeof b.detalhe === "object" ? b.detalhe : {}) as Record<string, unknown>;
    const destino = limpa(d.destino, 20);
    detalhe = {
      destino: destino && DESTINOS.has(destino) ? destino : "outro",
      local: limpa(d.local, 40),
    };
  }

  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  const dispositivo = /mobile|android|iphone|ipad/.test(ua) ? "celular" : "computador";

  const { error } = await getClient()
    .from("site_eventos")
    .insert({
      visitante,
      sessao: idCurto(b.s),
      tipo,
      caminho: limpa(b.caminho, 100),
      canal: derivarCanal(origem),
      ...origem,
      dispositivo,
      detalhe,
    });
  if (error) console.error("[site/evento]", error.message);
  return new NextResponse(null, { status: 204 });
}
