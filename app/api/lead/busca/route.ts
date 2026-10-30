import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { apenasDigitos } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/lead/busca?q=maria  |  ?q=4899162  — procura lead por nome ou por trecho do telefone (até 8 resultados).
// Consultor vê só os leads dele; admin vê todos.
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const bruto = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const nome = bruto.replace(/[%_,()*]/g, " ").trim();
  const digitos = apenasDigitos(bruto);
  if (nome.length < 2 && digitos.length < 3) return NextResponse.json({ ok: true, itens: [] });

  let q = getClient().from("ff_contatos").select("telefone, nome").order("ultima_interacao", { ascending: false }).limit(8);
  if (sess.papel === "vendedor") q = q.eq("vendedor_slug", sess.vslug ?? "__nenhum__");
  const filtros: string[] = [];
  if (nome.length >= 2 && !/^[0-9 ()+-]+$/.test(bruto)) filtros.push(`nome.ilike.%${nome}%`);
  if (digitos.length >= 3) filtros.push(`telefone.like.%${digitos}%`);
  if (!filtros.length) return NextResponse.json({ ok: true, itens: [] });
  const r = await q.or(filtros.join(","));
  if (r.error) return NextResponse.json({ ok: false, error: "Não consegui buscar." }, { status: 500 });
  return NextResponse.json({ ok: true, itens: (r.data ?? []) as { telefone: string; nome: string | null }[] });
}
