import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { podeGerenciarInstancia, instanciasPermitidas } from "@/lib/escopo";
import { evolutionConnect } from "@/lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/evolution/connect  { instancia? }
// Devolve o QR (base64) / pairingCode para parear o WhatsApp daquela instância.
// Se já estiver conectada, devolve state 'open' sem QR (chamada não-destrutiva).
//
// SEGURANÇA: o QR PAREIA UM APARELHO à conta de WhatsApp. Por isso a sessão só
// recebe o QR de uma instância que ela pode gerenciar — consultor só a dele,
// admin as dos consultores ativos. Instância desconhecida/alheia ⇒ 403.
export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  let instancia = "";
  try {
    const b = (await req.json().catch(() => ({}))) as { instancia?: unknown };
    instancia = String(b?.instancia ?? "").trim();
  } catch {
    instancia = "";
  }

  // Sem instância explícita: usa a única que a sessão pode gerenciar. Com mais
  // de uma (admin), exige escolher — não adivinha qual número parear.
  if (!instancia) {
    const permitidas = await instanciasPermitidas(sess);
    if (permitidas.length === 1) {
      instancia = permitidas[0].instancia;
    } else {
      return NextResponse.json(
        { ok: false, error: "Escolha qual número conectar." },
        { status: 400 },
      );
    }
  }

  if (!(await podeGerenciarInstancia(sess, instancia))) {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }

  const r = await evolutionConnect(instancia);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
