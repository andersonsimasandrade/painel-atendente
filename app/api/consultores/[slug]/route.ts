import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { atualizarConsultor, validarPatch } from "@/lib/consultores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/consultores/[slug]  { nome?, telefone_dono?, instancia_whatsapp?, ativo? }
//
// O slug vem SEMPRE da URL, nunca do corpo — senão um corpo com {"slug":"outro"}
// escolheria a vítima. `validarPatch` recusa qualquer campo fora da whitelist,
// o que também impede mexer em slug/instancia_whatsapp por aqui.
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } },
) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  }

  const slug = decodeURIComponent(params.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Consultor não informado." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  const v = validarPatch(body);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.erro }, { status: 400 });

  const r = await atualizarConsultor(slug, v.patch);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.erro }, { status: r.status });

  return NextResponse.json({ ok: true, consultor: r.consultor });
}
