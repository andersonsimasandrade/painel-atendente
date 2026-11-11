import { NextResponse } from "next/server";
import { salvarCadastro } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pública (site): o paciente envia os próprios dados pelo link privado do convite (uso único, vale 7 dias).
export async function POST(req: Request, { params }: { params: { codigo: string } }) {
  const codigo = String(params.codigo ?? "");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await salvarCadastro(codigo, {
    nome: String(b.nome ?? ""),
    email: String(b.email ?? ""),
    nascimento: String(b.nascimento ?? ""),
    cpf: String(b.cpf ?? ""),
    cep: String(b.cep ?? ""),
    logradouro: String(b.logradouro ?? ""),
    numero: String(b.numero ?? ""),
    complemento: String(b.complemento ?? ""),
    bairro: String(b.bairro ?? ""),
    cidade: String(b.cidade ?? ""),
    uf: String(b.uf ?? ""),
    telefoneOk: b.telefoneOk !== false,
    telefoneOutro: String(b.telefoneOutro ?? ""),
    aceite: b.aceite === true,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
