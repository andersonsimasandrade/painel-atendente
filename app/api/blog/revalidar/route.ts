import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook para o outro projeto (Central Viral) chamar quando um artigo mudar para "publicado" (ou for editado):
//   curl -X POST https://painel.andersonandradefisio.com.br/api/blog/revalidar -H "Authorization: Bearer $CRON_SECRET"
// Limpa o cache do blog (lista, artigos, relacionados e sitemap). Sem isso, o site se atualiza sozinho a cada 1 hora.
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  revalidateTag("blog");
  return NextResponse.json({ ok: true, revalidado: "blog" });
}

export const POST = handler;
export const GET = handler;
