import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { definirNascimento, enviarConviteCadastro, marcarConferido } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST { acao: "pedir" | "conferido" | "nascimento", nascimento? }
//   pedir      → envia por WhatsApp o link para o paciente preencher o próprio cadastro
//   conferido  → o Anderson confirma que os dados preenchidos pelo paciente estão certos
//   nascimento → grava/limpa a data de nascimento (dd/mm/aaaa)
export async function POST(req: Request, { params }: { params: { telefone: string } }) {
  const t = decodeURIComponent(params.telefone ?? "").trim();
  const barrado = await barrarSeNaoPode(t);
  if (barrado) return barrado;
  const b = (await req.json().catch(() => ({}))) as { acao?: string; nascimento?: string };
  const r =
    b.acao === "pedir"
      ? await enviarConviteCadastro(t)
      : b.acao === "conferido"
        ? await marcarConferido(t)
        : b.acao === "nascimento"
          ? await definirNascimento(t, String(b.nascimento ?? ""))
          : ({ ok: false, error: "Ação inválida." } as const);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
