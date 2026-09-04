import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { lerPausaWebhook } from "@/lib/painel-pausa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversa/[telefone]/bot — o bot está pausado nesta conversa?
//
// A pausa vive no Redis, escrita pelo n8n. O painel não fala com o Redis, então
// pergunta pelo webhook de leitura. Existe porque o selo "bot ativo" era estado
// local otimista: dizia ativo mesmo com a conversa assumida por uma pessoa.
//
// `pausado: null` = não deu pra saber. A tela mostra isso como incerteza em vez
// de chutar "ativo" — chutar é o bug que estamos consertando.
export async function GET(
  _req: Request,
  { params }: { params: { telefone: string } },
) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;

  const r = await lerPausaWebhook(telefone);
  return NextResponse.json({
    ok: r.pausado !== null,
    pausado: r.pausado,
    ...(r.error ? { error: r.error } : {}),
  });
}
