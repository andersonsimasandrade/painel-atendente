import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { barrarSemSessao } from "@/lib/ig-dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/instagram/estado { id, estado: "humano" | "robo" } — assume a conversa ou devolve ao robô.
export async function POST(req: Request) {
  const barrado = await barrarSemSessao();
  if (barrado) return barrado;
  let id = "";
  let estado = "";
  try {
    const b = (await req.json()) as { id?: unknown; estado?: unknown };
    id = String(b.id ?? "").replace(/\D/g, "");
    estado = String(b.estado ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  if (!id || (estado !== "humano" && estado !== "robo")) {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const upd =
    estado === "humano"
      ? { estado, humano_ate: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }
      : { estado, humano_ate: null };
  const r = await getClient().from("ig_contatos").update(upd).eq("ig_id", id).select("ig_id");
  if (r.error || !r.data?.length) return NextResponse.json({ ok: false, error: "Não consegui atualizar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
