import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/session";
import { getClient } from "@/lib/db";
import { gerarCodigoParceiro } from "@/lib/indicacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/parceiros { nome }            → cadastra um parceiro novo (o código do link sai do nome)
// POST /api/parceiros { id, ativo }       → liga/desliga um parceiro (desligado: link e formulário param de funcionar)
export async function POST(req: Request) {
  if (!(await ehAdmin())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const sb = getClient();
  if (typeof b.ativo === "boolean" && Number.isInteger(b.id)) {
    await sb.from("parceiros").update({ ativo: b.ativo }).eq("id", b.id as number);
    return NextResponse.json({ ok: true });
  }
  const nome = String(b.nome ?? "").trim().slice(0, 80);
  const codigo = gerarCodigoParceiro(nome);
  if (!nome || codigo.length < 2) return NextResponse.json({ ok: false, error: "Informe o nome do parceiro." }, { status: 400 });
  const r = await sb.from("parceiros").insert({ nome, codigo });
  if (r.error) {
    const dup = /duplicate|unique/i.test(r.error.message);
    return NextResponse.json({ ok: false, error: dup ? "Já existe um parceiro com esse nome." : "Não consegui cadastrar." }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, codigo });
}
