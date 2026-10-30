import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { apenasDigitos } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trechos de telefone para procurar, cobrindo o cadastro COM e SEM o 9 da frente (o WhatsApp entrega muitos números antigos sem ele).
// Ex.: digitou 48991625816 -> procura "48991625816" e "4891625816"; digitou 4891625816 -> procura também "48991625816".
function padroesTelefone(digitos: string): string[] {
  const nacional = digitos.startsWith("55") && digitos.length > 4 ? digitos.slice(2) : digitos;
  if (nacional.length < 4) return [];
  const ddd = nacional.slice(0, 2);
  const local = nacional.slice(2);
  const out = new Set<string>([nacional]);
  if (local.length >= 2 && local.startsWith("9")) out.add(ddd + local.slice(1)); // cadastro sem o 9
  if (local.length >= 1 && !local.startsWith("9")) out.add(ddd + "9" + local); // cadastro com o 9
  if (local.length >= 8 && local.startsWith("9") && local.length === 8) out.add(ddd + "9" + local); // digitou 8 dígitos começando em 9
  return [...out];
}

// GET /api/lead/busca?q=maria  |  ?q=4899162  — procura lead por nome ou por trecho do telefone (até 8 resultados).
// Consultor vê só os leads dele; admin vê todos.
export async function GET(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const bruto = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const nome = bruto.replace(/[%_,()*]/g, " ").trim();
  const digitos = apenasDigitos(bruto);
  if (nome.length < 2 && digitos.length < 4) return NextResponse.json({ ok: true, itens: [] });

  let q = getClient().from("ff_contatos").select("telefone, nome").order("ultima_interacao", { ascending: false }).limit(8);
  if (sess.papel === "vendedor") q = q.eq("vendedor_slug", sess.vslug ?? "__nenhum__");
  const filtros: string[] = [];
  if (nome.length >= 2 && !/^[0-9 ()+-]+$/.test(bruto)) filtros.push(`nome.ilike.%${nome}%`);
  for (const pad of padroesTelefone(digitos)) filtros.push(`telefone.like.%${pad}%`);
  if (!filtros.length) return NextResponse.json({ ok: true, itens: [] });
  const r = await q.or(filtros.join(","));
  if (r.error) return NextResponse.json({ ok: false, error: "Não consegui buscar." }, { status: 500 });
  return NextResponse.json({ ok: true, itens: (r.data ?? []) as { telefone: string; nome: string | null }[] });
}
