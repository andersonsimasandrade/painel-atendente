import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { salvarMsgs } from "@/lib/funil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { key, msgs: [{ atraso_min, texto }] } — substitui a sequência da etapa.
// Só admin (é configuração global; as mensagens saem no WhatsApp dos leads).
export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  if (sess.papel !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }

  let key = "";
  let msgs: { atraso_min: number; texto: string }[] = [];
  try {
    const b = (await req.json()) as { key?: unknown; msgs?: unknown };
    key = String(b.key ?? "").trim();
    msgs = Array.isArray(b.msgs)
      ? b.msgs.map((m) => {
          const o = (m ?? {}) as { atraso_min?: unknown; texto?: unknown };
          return { atraso_min: Number(o.atraso_min ?? 0), texto: String(o.texto ?? "") };
        })
      : [];
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!key) return NextResponse.json({ ok: false, error: "Etapa obrigatória." }, { status: 400 });

  const r = await salvarMsgs(key, msgs);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "Etapa não encontrada." ? 404 : 400 });
  return NextResponse.json(r);
}
