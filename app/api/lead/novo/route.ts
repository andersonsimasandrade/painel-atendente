import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";
import { getClient } from "@/lib/db";
import { resolverLead } from "@/lib/agenda";
import { apenasDigitos } from "@/lib/format";
import { parceiroPorCodigo } from "@/lib/indicacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lead/novo { telefone, nome, origem, observacoes }
// Cadastro manual de um lead (quem ligou, indicação, conversa pelo celular...). Só quem está logado no painel.
// Se o número já existe, não duplica: completa nome/observação e devolve o cadastro que já havia.
const ORIGENS = ["indicacao", "instagram", "google", "meta", "site", "youtube"] as const;

export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const digitado = apenasDigitos(String(b.telefone ?? ""));
  if (digitado.length < 10 || digitado.length > 15) {
    return NextResponse.json({ ok: false, error: "Informe o WhatsApp com DDD." }, { status: 400 });
  }
  const nome = String(b.nome ?? "").trim().slice(0, 120) || null;
  const obs = String(b.observacoes ?? "").trim().slice(0, 500) || null;
  const origem = ORIGENS.find((o) => o === b.origem) ?? null;

  const sb = getClient();
  // Parceiro que indicou (só vale se a origem for "indicação" e o código existir).
  const codigoParceiro = String(b.parceiro ?? "").trim().slice(0, 60);
  const parceiro = origem === "indicacao" && codigoParceiro && (await parceiroPorCodigo(codigoParceiro)) ? codigoParceiro : null;
  const existente = await resolverLead(digitado);
  if (existente) {
    const r = await sb.from("ff_contatos").select("nome, observacoes").eq("telefone", existente).limit(1);
    const atual = (r.data?.[0] ?? null) as { nome: string | null; observacoes: string | null } | null;
    const upd: Record<string, unknown> = {};
    if (nome && !atual?.nome) upd.nome = nome;
    if (obs) upd.observacoes = [atual?.observacoes, obs].filter(Boolean).join("\n");
    if (Object.keys(upd).length) await sb.from("ff_contatos").update(upd).eq("telefone", existente);
    return NextResponse.json({ ok: true, telefone: existente, jaExistia: true });
  }

  const ins = await sb.from("ff_contatos").insert({
    telefone: digitado,
    nome,
    observacoes: obs,
    origem_canal: origem,
    origem_parceiro: origem === "indicacao" ? parceiro : null,
    origem_manual: !!origem,
    origem_em: origem ? new Date().toISOString() : null,
    ultima_instancia: (process.env.EVOLUTION_INSTANCE ?? "").trim() || null,
  });
  if (ins.error) return NextResponse.json({ ok: false, error: "Não consegui cadastrar." }, { status: 500 });
  return NextResponse.json({ ok: true, telefone: digitado, jaExistia: false });
}
