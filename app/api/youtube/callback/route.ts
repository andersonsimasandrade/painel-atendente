import { NextResponse, type NextRequest } from "next/server";
import { concluirAutorizacao } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const pagina = (titulo: string, texto: string, status = 200) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><body style="font-family:system-ui;max-width:520px;margin:15vh auto;padding:0 20px;color:#243635"><h2>${titulo}</h2><p>${texto}</p><p><a href="/">Voltar ao painel</a></p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const esperado = req.cookies.get("yt_state")?.value;
  if (url.searchParams.get("error")) return pagina("Autorização cancelada", "Nada foi alterado. Para tentar de novo, abra o endereço /api/youtube/conectar no painel.", 400);
  if (!esperado || esperado !== url.searchParams.get("state")) return pagina("Link expirado", "Abra /api/youtube/conectar no painel e tente de novo.", 400);
  const code = url.searchParams.get("code");
  if (!code) return pagina("Faltou o código", "O Google não devolveu o código de autorização.", 400);
  const r = await concluirAutorizacao(code);
  const res = r.ok
    ? pagina("YouTube conectado ✅", `Canal: <b>${r.canal}</b>. O painel passa a ler e responder os comentários (das 8h às 20h).`)
    : pagina("Não consegui conectar", `Motivo: ${r.erro}`, 400);
  res.cookies.delete("yt_state");
  return res;
}
