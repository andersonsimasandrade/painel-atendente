import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { chamarPausaWebhook } from "@/lib/painel-pausa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/conversa/[telefone]/pausa  { action: 'pause' | 'resume' }
// Assumir (pause) = o agente humano toma a conversa e o bot fica em silêncio;
// Devolver ao bot (resume) = limpa a pausa. Protegido pelo MESMO cookie de
// sessão do middleware (verifyToken) — sem sessão válida => 401, igual a
// /api/fechar.
export async function POST(
  req: Request,
  { params }: { params: { telefone: string } },
) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só age sobre lead DELE. 403 caso contrário.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json(
      { ok: false, error: "Telefone obrigatório." },
      { status: 400 },
    );
  }

  let action: "pause" | "resume" = "pause";
  try {
    const body = (await req.json()) as { action?: unknown };
    action = body.action === "resume" ? "resume" : "pause";
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const r = await chamarPausaWebhook(telefone, action);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error ?? "Falha no webhook de pausa." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, action });
}
