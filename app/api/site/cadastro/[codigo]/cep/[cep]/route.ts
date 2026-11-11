import { NextResponse } from "next/server";
import { conviteValido } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pública (site), só com convite válido: completa o endereço pelo CEP (ViaCEP). Nenhum dado da pessoa vai junto: só o CEP.
export async function GET(_req: Request, { params }: { params: { codigo: string; cep: string } }) {
  if (!(await conviteValido(String(params.codigo ?? "")))) return NextResponse.json({ ok: false, error: "Link inválido." }, { status: 404 });
  const cep = String(params.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ ok: false, error: "CEP deve ter 8 números." }, { status: 400 });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, error: "Não consegui consultar o CEP agora." }, { status: 502 });
    const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return NextResponse.json({ ok: false, error: "CEP não encontrado. Preencha o endereço à mão." }, { status: 404 });
    return NextResponse.json({ ok: true, logradouro: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: (j.uf ?? "").toUpperCase() });
  } catch {
    return NextResponse.json({ ok: false, error: "Sem resposta do serviço de CEP." }, { status: 502 });
  }
}
