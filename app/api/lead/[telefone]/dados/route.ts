import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { setDadosLead } from "@/lib/db";
import { parseValorBR } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/[telefone]/dados  { investimento? | marca? | origem? }
// Edição manual dos campos comerciais do Lead 360 (o humano tem a última
// palavra sobre o que a IA extraiu). String vazia limpa o campo.
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  const patch: Parameters<typeof setDadosLead>[1] = {};
  try {
    const b = (await req.json()) as Record<string, unknown>;
    if ("investimento" in b) {
      const raw = b.investimento;
      if (raw == null || (typeof raw === "string" && !raw.trim())) {
        patch.investimento = null; // limpar
      } else {
        // parseValorBR entende "3.500" e "3500,50" (Number() cru viraria 3.5)
        patch.investimento = typeof raw === "number" ? raw : parseValorBR(String(raw));
      }
    }
    if ("marca" in b) patch.marca = String(b.marca ?? "");
    if ("origem" in b) patch.origem = String(b.origem ?? "");
    for (const k of ["email", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cnpj", "etapa", "canal", "origem_canal"] as const) {
      if (k in b) patch[k] = String(b[k] ?? "");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "Nada pra salvar." }, { status: 400 });
  }

  const r = await setDadosLead(telefone, patch);
  if (!r.ok) {
    const status =
      r.error === "Lead não encontrado." ? 404 : r.error?.includes("inválido") ? 400 : 500;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json({ ok: true });
}
