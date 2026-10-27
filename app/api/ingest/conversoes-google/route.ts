import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { csvConversoesGoogle } from "@/lib/conversoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ingest/conversoes-google — arquivo CSV de conversões para o envio AGENDADO do Google Ads
// (Metas > Conversões > Uploads > Agendamentos > fonte HTTPS). Proteção: usuário "google" + senha = CONVERSOES_FEED_SENHA.
// Sem a variável configurada a rota recusa tudo.
function ok(req: Request): boolean {
  const esperado = (process.env.CONVERSOES_FEED_SENHA ?? "").trim();
  if (esperado.length < 16) return false;
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  const [usuario, ...resto] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
  const senha = resto.join(":");
  const a = Buffer.from(senha);
  const b = Buffer.from(esperado);
  return usuario === "google" && a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export async function GET(req: Request) {
  if (!ok(req)) {
    return new NextResponse("Não autorizado.", { status: 401, headers: { "www-authenticate": 'Basic realm="conversoes"' } });
  }
  return new NextResponse(await csvConversoesGoogle(), {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
  });
}
