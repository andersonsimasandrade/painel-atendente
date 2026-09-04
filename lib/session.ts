// Helper server-side p/ ler a sessão (papel/vendedor) do cookie nas páginas e
// nos componentes server (Header/SubNav). Nunca importar num Client Component.
import { cache } from "react";
import { cookies } from "next/headers";
import { COOKIE_NAME, getSessionClaims, type SessionClaims } from "./auth";
import { getClient } from "./db";

/**
 * O cookie é assinado e vale 7 dias — ele não sabe que alguém foi desligado.
 * Desativar um consultor no painel precisa tirar o acesso AGORA, não daqui a
 * uma semana. Por isso a sessão de VENDEDOR é confirmada contra o banco.
 *
 * Sessão de admin não consulta o banco: são poucas, são as pessoas de dentro, e
 * pagar um SELECT em toda renderização não se justifica.
 *
 * `cache()` do React memoiza por REQUISIÇÃO: uma página que lê a sessão em três
 * lugares faz uma consulta só.
 */
const vendedorAindaVale = cache(async (email: string, vslug: string): Promise<boolean> => {
  try {
    const supabase = getClient();
    const [usuario, consultor] = await Promise.all([
      // Cookie antigo pode não ter e-mail; nesse caso o consultor ativo basta.
      email
        ? supabase
            .from("dashboard_usuarios")
            .select("email")
            .eq("email", email)
            .eq("ativo", true)
            .limit(1)
        : Promise.resolve({ data: [{ email: "" }], error: null }),
      supabase.from("vendedores").select("slug").eq("slug", vslug).eq("ativo", true).limit(1),
    ]);
    if (usuario.error || consultor.error) {
      // Banco fora do ar não pode DESLOGAR o time inteiro. Falhar aqui mantém a
      // sessão: o cookie assinado segue sendo a garantia, como era antes.
      console.error(
        "[session] falha ao validar sessão:",
        usuario.error?.message ?? consultor.error?.message,
      );
      return true;
    }
    return !!usuario.data?.length && !!consultor.data?.length;
  } catch (e) {
    console.error("[session] exceção ao validar sessão:", e);
    return true;
  }
});

export async function getSessao(): Promise<SessionClaims | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const claims = await getSessionClaims(token);
  if (!claims) return null;
  if (claims.papel !== "vendedor") return claims;

  if (!claims.vslug) return { email: claims.email, papel: "revogado" };
  if (await vendedorAindaVale(claims.email ?? "", claims.vslug)) return claims;

  // Revogado: papel que NÃO é 'admin' nem 'vendedor', e SEM vslug.
  // Devolver null aqui seria um desastre — `escopoDaLista(null)` significa
  // "sem filtro", ou seja, o desativado passaria a enxergar a base INTEIRA.
  return { email: claims.email, papel: "revogado" };
}

/** true só se a sessão é de admin. Use nas rotas exclusivas de admin
 *  (defense-in-depth: não confiar só no middleware). */
export async function ehAdmin(): Promise<boolean> {
  return (await getSessao())?.papel === "admin";
}

/** Sessão assinada válida, mas sem acesso (consultor desativado). Serve pro
 *  painel explicar a tela vazia em vez de deixar a pessoa achando que quebrou. */
export async function ehRevogado(): Promise<boolean> {
  return (await getSessao())?.papel === "revogado";
}
