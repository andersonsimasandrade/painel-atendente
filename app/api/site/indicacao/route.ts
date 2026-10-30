import { NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { criarIndicacao } from "@/lib/indicacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site/indicacao — o parceiro indica um paciente (página /indicar/<codigo>, sem login).
// NÃO envia mensagem a ninguém: só registra. A primeira mensagem sai depois, com um clique do Anderson, no painel.
function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  if (await rateLimited(`site-indicacao:${clientIp(req)}`, 10, 3600)) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde um pouco." }, { status: 429 });
  }
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  if (texto(b.site_url, 200)) return NextResponse.json({ ok: true }); // honeypot

  const r = await criarIndicacao({
    parceiroCodigo: texto(b.codigo, 60),
    pacienteNome: texto(b.paciente_nome, 120),
    pacienteTelefone: texto(b.paciente_telefone, 30),
    quemIndicou: texto(b.quem_indicou, 80),
    observacao: texto(b.observacao, 300),
    consentimento: b.consentimento === true,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.erro ?? "Não foi possível registrar." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
