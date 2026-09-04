import { NextResponse } from "next/server";
import { listarConsultores } from "@/lib/consultores";
import { getSessao } from "@/lib/session";
import { assinarConviteEnv } from "@/lib/convite";
import { getVendedorBySlug } from "@/lib/agenda";
import { apenasDigitos } from "@/lib/format";
import { appBaseUrl, clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { slug?, telefone } — gera um link de convite TRAVADO no telefone e no
// vendedor. Protegido pelo cookie de sessão (como /api/fechar). NÃO envia
// WhatsApp: só devolve o link pro operador mandar como quiser.
export async function POST(req: Request) {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  // Teto de emissão por IP (fail-closed): impede cunhar convites em massa, que
  // depois poderiam disparar WhatsApp a muitos números frios (risco de ban).
  if (await rateLimited(`convite:${clientIp(req)}`, 30, 86400, { failClosed: true })) {
    return NextResponse.json(
      { ok: false, error: "Muitos convites gerados hoje. Tente novamente amanhã." },
      { status: 429 },
    );
  }

  // Sem slug no corpo, usa o primeiro consultor ativo cadastrado.
  let slug = "";
  let telefone = "";
  try {
    const b = (await req.json()) as { slug?: unknown; telefone?: unknown };
    if (b.slug != null) slug = String(b.slug);
    telefone = apenasDigitos(String(b.telefone ?? ""));
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }

  if (telefone.length < 10 || telefone.length > 15) {
    return NextResponse.json(
      { ok: false, error: "Informe um telefone válido com DDD." },
      { status: 400 },
    );
  }

  // Vendedor só emite convite pra PRÓPRIA agenda (ignora slug do corpo).
  if (sess.papel === "vendedor") {
    if (!sess.vslug) {
      return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
    }
    slug = sess.vslug;
  }

  // Sem slug: cai no primeiro consultor ativo. Se não houver nenhum, o erro
  // aponta o conserto (a seção PREENCHA do BANCO-supabase.sql).
  if (!slug) {
    const ativos = await listarConsultores(true);
    if (!ativos.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nenhum consultor ativo cadastrado. Cadastre um em Ajustes → Consultores " +
            "(ou rode a seção PREENCHA do BANCO-supabase.sql).",
        },
        { status: 409 },
      );
    }
    slug = ativos[0].slug;
  }

  const vend = await getVendedorBySlug(slug);
  if (!vend) {
    return NextResponse.json({ ok: false, error: "Agenda não encontrada." }, { status: 404 });
  }

  const { token: convite, exp } = assinarConviteEnv(vend.slug, telefone);
  const qs = new URLSearchParams({ lead: telefone, convite });
  const link = `${appBaseUrl()}/agendar/${encodeURIComponent(vend.slug)}?${qs.toString()}`;

  return NextResponse.json({ ok: true, link, expira_em: new Date(exp * 1000).toISOString() });
}
