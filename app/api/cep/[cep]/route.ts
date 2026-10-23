import { NextResponse } from "next/server";
import { getSessao } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cep/88085120 → { ok, logradouro, bairro, cidade, uf }
// Consulta o ViaCEP pelo servidor (só com o painel logado). Nenhum dado da pessoa é enviado: só o CEP.
export async function GET(_req: Request, { params }: { params: { cep: string } }) {
  if (!(await getSessao())) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const cep = String(params.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ ok: false, error: "CEP deve ter 8 números." }, { status: 400 });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, error: "Não consegui consultar o CEP agora." }, { status: 502 });
    const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return NextResponse.json({ ok: false, error: "CEP não encontrado." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      logradouro: j.logradouro ?? "",
      bairro: j.bairro ?? "",
      cidade: j.localidade ?? "",
      uf: (j.uf ?? "").toUpperCase(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Sem resposta do serviço de CEP." }, { status: 502 });
  }
}
