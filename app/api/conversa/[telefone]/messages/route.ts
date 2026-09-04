import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { getConversaDelta } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversa/[telefone]/messages?after=<id>
// Polling incremental da conversa ao vivo. Protegido pelo MESMO cookie de
// sessão do middleware (verifyToken) — sem sessão válida => 401, exatamente
// como /api/fechar. Lê via Supabase server (service_role) em lib/db.
// Retorna { messages: [{ id, autor, texto }] } com id > `after`, ordenado por
// id asc. Nunca expõe o session_id nem as tags internas de orquestração.
export async function GET(
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

  const afterRaw = new URL(req.url).searchParams.get("after");
  const parsed = Number.parseInt(afterRaw ?? "0", 10);
  const after = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  try {
    const messages = await getConversaDelta(telefone, after);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao ler a conversa." },
      { status: 500 },
    );
  }
}
