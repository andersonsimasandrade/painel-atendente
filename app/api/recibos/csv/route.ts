import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { csvRecibos, listarRecibos } from "@/lib/recibo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?mes=AAAA-MM → planilha (CSV, abre no Excel) dos recibos do mês, para a contabilidade. Só o administrador.
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess || sess.papel !== "admin") return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  const mes = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return NextResponse.json({ ok: false, error: "Informe o mês (AAAA-MM)." }, { status: 400 });
  const csv = csvRecibos(await listarRecibos(mes));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="recibos-${mes}.csv"`, "Cache-Control": "no-store" } });
}
