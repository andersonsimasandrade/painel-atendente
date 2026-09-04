import { NextResponse } from "next/server";
import { barrarSeNaoPode } from "@/lib/escopo";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { backfillDadosLead, getConversa, setResumoLead } from "@/lib/db";
import { gerarResumoLead } from "@/lib/resumo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monta a transcrição a partir das mensagens já limpas, limitando o tamanho
// (mantém as mais RECENTES, que importam mais pro resumo/score).
function montarTranscript(
  msgs: { role: "human" | "ai"; text: string; origem?: "painel" | "celular" | "bot" | null }[],
): string {
  // Consultor humano ≠ bot: a IA precisa saber o que foi promessa de gente.
  const linhas = msgs.map((m) => {
    const quem =
      m.role === "human"
        ? "Lead"
        : m.origem === "painel" || m.origem === "celular"
          ? "Consultor (humano)"
          : "Consultor (bot)";
    return `${quem}: ${m.text}`;
  });
  let t = linhas.join("\n");
  const MAX = 8000;
  if (t.length > MAX) t = "[...conversa anterior omitida...]\n" + t.slice(-MAX);
  return t;
}

// POST /api/lead/[telefone]/resumo — gera (Groq→OpenAI) + cacheia + retorna.
export async function POST(_req: Request, { params }: { params: { telefone: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!(await verifyToken(token))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const telefone = decodeURIComponent(params.telefone ?? "").trim();
  // Escopo (multi-consultor): consultor só age sobre lead DELE. 403 caso contrário.
  const barrado = await barrarSeNaoPode(telefone);
  if (barrado) return barrado;
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "Telefone obrigatório." }, { status: 400 });
  }

  const conversa = await getConversa(telefone);
  if (!conversa.length) {
    return NextResponse.json(
      { ok: false, error: "Ainda não há conversa pra resumir." },
      { status: 400 },
    );
  }

  const r = await gerarResumoLead(montarTranscript(conversa));
  if (!r) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Não consegui gerar o resumo — IA indisponível. Confira as variáveis GROQ_API_KEY / OPENAI_API_KEY.",
      },
      { status: 502 },
    );
  }

  const saved = await setResumoLead(telefone, r);

  // A mesma IA extrai perfil/cidade/CNPJ/marca/investimento — preenche SÓ os
  // campos ainda vazios do cadastro (o que o bot coletou por tag sempre vence).
  const preenchidos = r.dados ? await backfillDadosLead(telefone, r.dados) : [];

  return NextResponse.json({
    ok: true,
    resumo: r.resumo,
    temperatura: r.temperatura,
    proxima_acao: r.proxima_acao,
    provider: r.provider,
    resumo_em: saved.ok ? saved.resumo_em : new Date().toISOString(),
    persisted: saved.ok,
    campos_preenchidos: preenchidos,
  });
}
