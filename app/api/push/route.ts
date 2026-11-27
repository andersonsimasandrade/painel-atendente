import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { assinaturaConhecida, chavePublica, contarAparelhos,enviarAviso, removerAssinatura, salvarAssinatura, type Assinatura } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avisos no celular. Só administrador (os avisos mostram os nomes de todos os pacientes).
//   GET                          → { chave, aparelhos }
//   POST { acao:"assinar", subscription, aparelho? }
//   POST { acao:"cancelar", endpoint }
//   POST { acao:"teste" }        → manda um aviso de teste para os aparelhos desta conta
async function admin() {
  const sess = await getSessao();
  if (!sess) return { erro: NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 }) };
  if (sess.papel !== "admin") return { erro: NextResponse.json({ ok: false, error: "Só o administrador usa os avisos." }, { status: 403 }) };
  return { email: sess.email ?? "admin" };
}

export async function GET(req: Request) {
  const a = await admin();
  if (a.erro) return a.erro;
  try {
    const endpoint = new URL(req.url).searchParams.get("endpoint");
    const conhecido = endpoint ? await assinaturaConhecida(endpoint) : false;
    return NextResponse.json({ ok: true, chave: await chavePublica(), aparelhos: await contarAparelhos(a.email), conhecido });
  } catch (e) {
    console.error("[push] GET:", e);
    return NextResponse.json({ ok: false, error: "Não consegui preparar os avisos agora." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const a = await admin();
  if (a.erro) return a.erro;
  let b: { acao?: string; subscription?: Assinatura; endpoint?: string; aparelho?: string };
  try {
    b = (await req.json()) as typeof b;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  if (b.acao === "assinar") {
    const s = b.subscription;
    if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth || !/^https:\/\//.test(s.endpoint)) {
      return NextResponse.json({ ok: false, error: "Aparelho inválido." }, { status: 400 });
    }
    const ok = await salvarAssinatura(a.email, s, typeof b.aparelho === "string" ? b.aparelho : null);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: "Não consegui salvar o aparelho." }, { status: 500 });
  }
  if (b.acao === "cancelar") {
    if (b.endpoint) await removerAssinatura(b.endpoint);
    return NextResponse.json({ ok: true });
  }
  if (b.acao === "teste") {
    try {
      const n = await enviarAviso({ titulo: "✅ Avisos ligados", corpo: "Deu certo! Você receberá as mensagens e as sessões por aqui.", url: "/", tag: "teste" }, a.email);
      return n ? NextResponse.json({ ok: true, enviados: n }) : NextResponse.json({ ok: false, error: "Nenhum aparelho recebeu. Ative os avisos neste aparelho primeiro." }, { status: 400 });
    } catch (e) {
      console.error("[push] teste:", e);
      return NextResponse.json({ ok: false, error: "Não consegui enviar o teste agora." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: false, error: "Ação desconhecida." }, { status: 400 });
}
