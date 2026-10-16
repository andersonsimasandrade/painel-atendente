import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getClient } from "@/lib/db";
import { assinaturaValida, extrairEventos } from "@/lib/instagram";
import { processarEventos } from "@/lib/ig-robo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// /api/instagram/webhook — recebe mensagens e comentários do Instagram.
//
// GET  : verificação da Meta ao cadastrar o webhook (hub.challenge).
// POST : eventos. Só aceita se a assinatura X-Hub-Signature-256 bater com o segredo do app.
//        Cada evento é gravado em ig_eventos (sem duplicar) e, se INSTAGRAM_FORWARD_URL existir,
//        repassado ao robô (n8n) com o cabeçalho x-segredo = INSTAGRAM_FORWARD_SECRET.
// Sem as variáveis configuradas a rota recusa tudo (nunca fica aberta).

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(new Uint8Array(x), new Uint8Array(y));
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const esperado = (process.env.INSTAGRAM_VERIFY_TOKEN ?? "").trim();
  const token = u.searchParams.get("hub.verify_token") ?? "";
  const desafio = u.searchParams.get("hub.challenge") ?? "";
  if (esperado.length >= 12 && u.searchParams.get("hub.mode") === "subscribe" && igual(token, esperado) && desafio) {
    return new Response(desafio, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Diário de tentativas (sem conteúdo nem segredos): ajuda a saber se a Meta entregou e se a assinatura bateu.
async function diario(corpo: string, assinaturaOk: boolean, temAssinatura: boolean) {
  try {
    let objeto = "";
    let campos = "";
    try {
      const j = JSON.parse(corpo) as { object?: string; entry?: { messaging?: unknown; changes?: { field?: string }[] }[] };
      objeto = String(j.object ?? "");
      campos = (j.entry ?? [])
        .flatMap((e) => [e.messaging ? "messaging" : "", ...(e.changes ?? []).map((c) => String(c.field ?? ""))])
        .filter(Boolean)
        .join(",");
    } catch {
      /* corpo que não é JSON */
    }
    await getClient().from("ig_tentativas").insert({
      metodo: "POST",
      tem_assinatura: temAssinatura,
      assinatura_ok: assinaturaOk,
      tamanho: corpo.length,
      objeto: objeto.slice(0, 40),
      campos: campos.slice(0, 200),
    });
  } catch (e) {
    console.error("[instagram/webhook] diario:", e instanceof Error ? e.message : e);
  }
}

export async function POST(req: Request) {
  const corpo = await req.text();
  const cab = req.headers.get("x-hub-signature-256");
  const ok = corpo.length <= 200_000 && assinaturaValida(corpo, cab);
  await diario(corpo, ok, Boolean(cab));
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const eventos = extrairEventos(json);
  if (!eventos.length) return NextResponse.json({ ok: true, eventos: 0 });

  const supabase = getClient();
  const novos: typeof eventos = [];
  for (const e of eventos) {
    const linha = {
      tipo: e.tipo,
      ig_conta: e.ig_conta,
      remetente_id: e.remetente_id,
      remetente_user: e.remetente_user,
      mid: e.mid,
      comentario_id: e.comentario_id,
      midia_id: e.midia_id,
      texto: e.texto?.slice(0, 2000) ?? null,
      bruto: e,
    };
    // upsert com ignoreDuplicates: reenvio da Meta não cria linha nova.
    const r = await supabase
      .from("ig_eventos")
      .upsert(linha, { onConflict: e.mid ? "mid" : "comentario_id", ignoreDuplicates: true })
      .select("id");
    if (r.error) {
      console.error("[instagram/webhook] gravar:", r.error.message);
      continue;
    }
    if (r.data?.length) novos.push(e); // só o que é realmente novo segue para o robô
  }

  // O robô responde em segundo plano: a Meta recebe o "200" na hora e não reenvia o evento.
  if (novos.length) void processarEventos(novos);

  const url = (process.env.INSTAGRAM_FORWARD_URL ?? "").trim();
  if (url && novos.length) {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-segredo": (process.env.INSTAGRAM_FORWARD_SECRET ?? "").trim(),
        },
        body: JSON.stringify({ eventos: novos }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error("[instagram/webhook] repasse ao robô:", err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ ok: true, eventos: eventos.length, novos: novos.length });
}
