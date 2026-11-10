import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { definirAlta } from "@/lib/pacientes-tratamento";
import { resolverLead } from "@/lib/agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { alta: boolean } → dá alta ao paciente (sai de "Em tratamento") ou reabre o tratamento. Só logado e do próprio escopo.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { alta?: boolean };
  const real = (await resolverLead(t)) ?? t;
  const r = await definirAlta(real, b.alta !== false);
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
