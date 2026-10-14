import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listarParaSync } from "@/lib/agenda";
import { CONSULTORIOS } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agenda/sync — lista as avaliações para o Google Agenda.
// Quem chama é um Apps Script na conta Google do Anderson, a cada poucos minutos.
// Autenticação: Authorization: Bearer <AGENDA_SYNC_TOKEN> (sem a variável, recusa tudo).
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
  const itens = await listarParaSync();
  const eventos = itens.map((a) => {
    const cons = a.local === "capoeiras" || a.local === "centro" ? CONSULTORIOS[a.local] : null;
    const ini = new Date(a.data_hora);
    const fim = new Date(ini.getTime() + a.duracao_min * 60000);
    return {
      id: a.id,
      cancelado: a.status === "cancelado",
      status: a.status,
      titulo: `Fisioterapia: ${a.nome ?? a.telefone}`,
      inicio: ini.toISOString(),
      fim: fim.toISOString(),
      local: cons ? `${cons.nome} — ${cons.linhaEndereco}` : "",
      descricao: `Paciente: ${a.nome ?? "—"}\nWhatsApp: https://wa.me/${a.telefone}\nOrigem: ${a.origem ?? "—"}\nStatus: ${a.status}`,
    };
  });
  return NextResponse.json({ ok: true, eventos });
}
