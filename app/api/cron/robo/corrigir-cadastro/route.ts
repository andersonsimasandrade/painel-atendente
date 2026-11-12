import { NextResponse } from "next/server";
import { corrigirCadastro } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/robo/corrigir-cadastro { telefone, correcoes: [{ campo, valor }] } (Bearer CRON_SECRET)
// (também aceita { telefone, campo, valor }.) O paciente pediu, pelo WhatsApp, para corrigir dados do cadastro: tags [CORRIGIR: campo=valor] do robô.
// Campos: nome, email, nascimento (dd/mm/aaaa), cpf, cep, rua, numero, complemento, bairro, cidade, uf.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { telefone?: unknown; campo?: unknown; valor?: unknown; correcoes?: { campo?: unknown; valor?: unknown }[] };
  const telefone = String(b.telefone ?? "");
  const lista = Array.isArray(b.correcoes) ? b.correcoes : [{ campo: b.campo, valor: b.valor }];
  const resultados: { campo: string; ok: boolean; erro?: string }[] = [];
  for (const c of lista.slice(0, 12)) {
    const r = await corrigirCadastro(telefone, String(c.campo ?? ""), String(c.valor ?? ""));
    resultados.push({ campo: String(c.campo ?? ""), ok: r.ok, ...(r.ok ? {} : { erro: r.error }) });
  }
  return NextResponse.json({ ok: resultados.length > 0 && resultados.every((r) => r.ok), resultados });
}
