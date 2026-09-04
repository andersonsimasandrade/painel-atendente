// Escopo por dono do lead (multi-consultor). SERVER-ONLY: toca o banco, então
// não pode ser importado pelo middleware (Edge) — a checagem de ROTA continua
// em lib/perm.ts (pura); aqui é a checagem de OBJETO.
//
// Por que existe: filtrar a lista não impede alguém de digitar a URL de um lead
// alheio. Toda rota que lê ou age sobre UM lead precisa passar por aqui.
import { NextResponse } from "next/server";
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { getSessao } from "./session";
import type { SessionClaims } from "./auth";

/** vendedor_slug dono do lead, ou null se não achar. Tolera o nono dígito. */
export async function donoDoLead(telefone: string): Promise<string | null> {
  const variantes = variantesTelefone(telefone);
  if (!variantes.length) return null;
  try {
    const res = await getClient()
      .from("ff_contatos")
      .select("vendedor_slug")
      .in("telefone", variantes)
      .limit(1);
    if (res.error || !res.data?.length) return null;
    return (res.data[0] as { vendedor_slug: string | null }).vendedor_slug ?? null;
  } catch (e) {
    console.error("[escopo] donoDoLead:", e);
    return null;
  }
}

/**
 * A sessão pode ver/agir sobre este lead?
 *  • admin  → sempre;
 *  • qualquer outro papel → só se o lead é dele (fail-CLOSED: sem sessão, sem
 *    vslug, lead inexistente ou dono diferente ⇒ false).
 *
 * Testamos `=== "admin"`, nunca `!== "vendedor"`: um papel novo (hoje
 * 'revogado') não pode virar admin por omissão.
 */
export async function podeVerLead(
  sess: SessionClaims | null,
  telefone: string,
): Promise<boolean> {
  if (!sess) return false;
  if (sess.papel === "admin") return true;
  if (!sess.vslug) return false;
  const dono = await donoDoLead(telefone);
  return !!dono && dono === sess.vslug;
}

export interface InstanciaPermitida {
  slug: string;
  nome: string;
  instancia: string;
}

/**
 * Instâncias de WhatsApp que esta sessão pode VER e RECONECTAR.
 *  • admin → todas as dos consultores ativos;
 *  • vendedor → só a dele (fail-closed: sem vslug, nenhuma).
 *
 * Isso é sensível: o QR de uma instância PAREIA UM APARELHO àquele WhatsApp.
 * Um consultor não pode nem ver o QR do número de outro.
 */
export async function instanciasPermitidas(
  sess: SessionClaims | null,
): Promise<InstanciaPermitida[]> {
  if (!sess) return [];
  try {
    const res = await getClient()
      .from("vendedores")
      .select("slug, nome, instancia_whatsapp")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (res.error || !res.data) return [];
    const todas = (res.data as unknown as {
      slug: string;
      nome: string;
      instancia_whatsapp: string;
    }[]).map((v) => ({ slug: v.slug, nome: v.nome, instancia: v.instancia_whatsapp }));

    if (sess.papel === "admin") return todas;
    if (!sess.vslug) return [];
    return todas.filter((v) => v.slug === sess.vslug);
  } catch (e) {
    console.error("[escopo] instanciasPermitidas:", e);
    return [];
  }
}

/** A sessão pode ler o estado / gerar o QR desta instância? */
export async function podeGerenciarInstancia(
  sess: SessionClaims | null,
  instancia: string,
): Promise<boolean> {
  const alvo = String(instancia ?? "").trim();
  if (!alvo) return false;
  const permitidas = await instanciasPermitidas(sess);
  return permitidas.some((v) => v.instancia === alvo);
}

/**
 * Guard das rotas que leem ou agem sobre UM lead. Devolve a resposta de erro
 * pronta (401/403) quando deve barrar, ou null quando pode seguir.
 *
 *   const barrado = await barrarSeNaoPode(telefone);
 *   if (barrado) return barrado;
 *
 * Um lugar só: se a regra mudar, muda aqui — não em nove rotas.
 */
export async function barrarSeNaoPode(telefone: string): Promise<NextResponse | null> {
  const sess = await getSessao();
  if (!sess) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  if (!(await podeVerLead(sess, telefone))) {
    return NextResponse.json({ ok: false, error: "Acesso restrito." }, { status: 403 });
  }
  return null;
}

/**
 * Qual dono usar nas LISTAS, a partir da sessão e do filtro da URL.
 *  • admin → o que vier em ?consultor= (ou nada = vê todos);
 *  • qualquer outro caso → o próprio slug; sem slug, um valor que não casa com
 *    ninguém, pra listar VAZIO em vez de listar tudo.
 *
 * A condição é `!== "admin"` de propósito. Com `=== "vendedor"`, uma sessão
 * revogada (ou ausente) caía no ramo do admin e passava a enxergar a base
 * inteira — o oposto do que desativar alguém deveria fazer.
 */
export function escopoDaLista(
  sess: SessionClaims | null,
  consultorDaUrl?: string,
): string | undefined {
  if (sess?.papel !== "admin") return sess?.vslug || "__sem_escopo__";
  const c = (consultorDaUrl ?? "").trim();
  return c ? c : undefined;
}
