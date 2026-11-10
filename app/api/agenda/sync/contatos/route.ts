import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listarContatosParaGoogle } from "@/lib/contatos-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agenda/sync/contatos — pacientes (nome + telefone) para o script do Google copiar ao Google Contatos.
// Mesma autenticação do sync da agenda: Authorization: Bearer <AGENDA_SYNC_TOKEN> (sem a variável, recusa tudo).
function ok(req: Request): boolean {
  const esperado = (process.env.AGENDA_SYNC_TOKEN ?? "").trim();
  if (esperado.length < 24) return false;
  const h = req.headers.get("authorization") ?? "";
  const dado = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ ok: true, contatos: await listarContatosParaGoogle() });
}
