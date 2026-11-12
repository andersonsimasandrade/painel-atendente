import { NextResponse } from "next/server";
import { corrigirCadastro } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/robo/corrigir-cadastro { telefone, campo, valor } (Bearer CRON_SECRET)
// O paciente pediu, pelo WhatsApp, para corrigir um dado do cadastro (a tag [CORRIGIR: campo=valor] do robô).
// Campos: nome, email, nascimento (dd/mm/aaaa), cpf, cep, rua, numero, complemento, bairro, cidade, uf.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await corrigirCadastro(String(b.telefone ?? ""), String(b.campo ?? ""), String(b.valor ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
