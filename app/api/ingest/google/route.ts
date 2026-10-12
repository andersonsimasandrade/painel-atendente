import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ingest/google — recebe o desempenho diário do Google Ads.
// Quem chama é um Script que roda DENTRO da conta do Google Ads (de hora em
// hora). Autenticação: "Authorization: Bearer <GOOGLE_ADS_INGEST_SECRET>".
// Sem a variável configurada a rota recusa tudo (nunca fica aberta).

function segredoOk(req: Request): boolean {
  const esperado = (process.env.GOOGLE_ADS_INGEST_SECRET ?? "").trim();
  if (esperado.length < 24) return false;
  const h = req.headers.get("authorization") ?? "";
  const dado = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

interface LinhaIn {
  dia?: unknown;
  campanha_id?: unknown;
  campanha?: unknown;
  custo?: unknown;
  cliques?: unknown;
  impressoes?: unknown;
  conversoes?: unknown;
}

export async function POST(req: Request) {
  if (!segredoOk(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  let body: { rows?: LinhaIn[] };
  try {
    body = (await req.json()) as { rows?: LinhaIn[] };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
  const agora = new Date().toISOString();
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const dia = String(r.dia ?? "");
    const id = String(r.campanha_id ?? "").replace(/\D/g, "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !id) continue;
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    out.push({
      dia,
      campanha_id: id,
      campanha: String(r.campanha ?? "").slice(0, 200),
      custo: Math.round(num(r.custo) * 100) / 100,
      cliques: Math.round(num(r.cliques)),
      impressoes: Math.round(num(r.impressoes)),
      conversoes: Math.round(num(r.conversoes) * 100) / 100,
      atualizado_em: agora,
    });
  }
  if (!out.length) return NextResponse.json({ ok: true, gravados: 0 });
  const { error } = await getClient().from("trafego_google_diario").upsert(out, { onConflict: "dia,campanha_id" });
  if (error) {
    console.error("[ingest/google]", error.message);
    return NextResponse.json({ ok: false, error: "Falha ao gravar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, gravados: out.length });
}
