import { NextResponse } from "next/server";
import { barrarSemSessao, listarContatosIG } from "@/lib/ig-dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/instagram/contatos — conversas do Instagram (mais recentes primeiro).
export async function GET() {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  return NextResponse.json({ ok: true, contatos: await listarContatosIG() });
}
