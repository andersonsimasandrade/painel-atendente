import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { listarConsultores } from "@/lib/consultores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/consultores — lista para a tela de Ajustes.
// SÓ ADMIN: um consultor não enxerga (nem edita) a ficha do outro. O middleware
// já barra o papel vendedor nesta rota; este guard é a segunda camada.
export async function GET() {
  if (!(await ehAdmin())) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  }
  const consultores = await listarConsultores();
  return NextResponse.json({ ok: true, consultores });
}
