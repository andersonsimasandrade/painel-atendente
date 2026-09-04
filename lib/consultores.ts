// Consultores (tabela `vendedores`) — SOMENTE no servidor.
//
// Uma conversa tem DOIS consultores possíveis e eles nem sempre são o mesmo:
//   • o DONO do lead   (ff_contatos.vendedor_slug) — first-touch, não muda
//   • o CANAL          (ff_contatos.ultima_instancia) — o número que recebeu
//     a última mensagem
//
// Quem FALA com o lead é o canal: é o número de onde a resposta sai e o nome
// que o lead lê. A posse continua sendo do dono, pra ninguém herdar lead alheio
// só porque o lead escreveu no outro número. Este módulo resolve o canal.

import { getClient } from "./db";
import { variantesTelefone } from "./telefone";

export interface Consultor {
  slug: string;
  nome: string;
  instancia_whatsapp: string;
  telefone_dono: string | null;
  ativo: boolean;
}

/** Último recurso quando a tabela `vendedores` não responde: usa a instância
 *  do ambiente, para o painel continuar de pé em vez de enviar por um canal
 *  indefinido. Se nem isso existir, o envio falha com erro explícito — que é
 *  melhor do que mandar mensagem pelo número errado. */
function consultorPadrao(): CanalDaConversa {
  const inst = (process.env.EVOLUTION_INSTANCE ?? "").trim();
  return { slug: "", nome: "", instancia: inst };
}

const COLS = "slug, nome, instancia_whatsapp, telefone_dono, ativo";

export async function listarConsultores(apenasAtivos = false): Promise<Consultor[]> {
  try {
    let q = getClient().from("vendedores").select(COLS).order("nome");
    if (apenasAtivos) q = q.eq("ativo", true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Consultor[]).filter((v) => v && v.slug);
  } catch {
    return [];
  }
}

export interface CanalDaConversa {
  slug: string;
  nome: string;
  instancia: string;
}

/**
 * De qual número esta conversa fala, e com que nome ela assina.
 *
 * Ordem: instância que recebeu a última mensagem → instância do dono do lead →
 * padrão. Nunca lança: envio e assinatura não podem quebrar por causa de um
 * SELECT.
 */
export async function canalDaConversa(telefone: string): Promise<CanalDaConversa> {
  const padrao: CanalDaConversa = consultorPadrao();
  const tel = (telefone ?? "").trim();
  if (!tel) return padrao;

  try {
    const supabase = getClient();
    const [contatoRes, vendRes] = await Promise.all([
      supabase
        .from("ff_contatos")
        .select("telefone, vendedor_slug, ultima_instancia")
        .in("telefone", variantesTelefone(tel))
        .limit(2),
      supabase.from("vendedores").select(COLS).eq("ativo", true),
    ]);

    const vendedores = (vendRes.data ?? []) as unknown as Consultor[];
    if (!vendedores.length) return padrao;

    const contato = (contatoRes.data ?? [])[0] as
      | { vendedor_slug?: string | null; ultima_instancia?: string | null }
      | undefined;

    const porInstancia = (i?: string | null) =>
      i ? vendedores.find((v) => v.instancia_whatsapp === i) : undefined;
    const porSlug = (s?: string | null) =>
      s ? vendedores.find((v) => v.slug === s) : undefined;

    // Sem correspondência explícita, cai no consultor da instância do
    // ambiente e, por último, no primeiro consultor ativo cadastrado.
    const achado =
      porInstancia(contato?.ultima_instancia) ??
      porSlug(contato?.vendedor_slug) ??
      porInstancia(padrao.instancia) ??
      vendedores[0];

    if (!achado) return padrao;
    return {
      slug: achado.slug,
      nome: achado.nome || padrao.nome,
      instancia: achado.instancia_whatsapp || padrao.instancia,
    };
  } catch {
    return padrao;
  }
}

// ── Edição pelo painel ───────────────────────────────────────────────────

export interface PatchConsultor {
  nome?: string;
  telefone_dono?: string | null;
  instancia_whatsapp?: string;
  ativo?: boolean;
}

/**
 * Campos que o painel pode escrever. `slug` fica de fora DE PROPÓSITO: ele é a
 * chave dos leads (ff_contatos.vendedor_slug), da URL /agendar/{slug} e dos
 * resumos por e-mail — trocar quebraria os três de uma vez.
 *
 * `instancia_whatsapp` É editável (só por admin) porque é o erro de instalação
 * mais comum: quem roda o BANCO-supabase.sql sem trocar o placeholder fica com
 * um consultor apontando para uma instância que não existe, e aí NADA sai pelo
 * WhatsApp. Sem esta tela, o conserto exigiria SQL na mão.
 */
const CAMPOS_EDITAVEIS = new Set(["nome", "telefone_dono", "instancia_whatsapp", "ativo"]);

export type Validacao =
  | { ok: true; patch: PatchConsultor }
  | { ok: false; erro: string };

/** Validação pura (testável sem banco). */
export function validarPatch(body: unknown): Validacao {
  if (!body || typeof body !== "object") return { ok: false, erro: "Corpo inválido." };
  const entrada = body as Record<string, unknown>;

  const desconhecido = Object.keys(entrada).find((k) => !CAMPOS_EDITAVEIS.has(k));
  if (desconhecido) {
    return { ok: false, erro: `Campo não editável: ${desconhecido}.` };
  }

  const patch: PatchConsultor = {};

  if ("nome" in entrada) {
    const nome = String(entrada.nome ?? "").trim();
    if (!nome) return { ok: false, erro: "O nome não pode ficar vazio." };
    // O painel remove a assinatura "*Nome:*" das mensagens com a regex
    // /^\s*\*[^*\n]{1,40}:\*\s*/. Um nome com 41+ caracteres, ou com "*"
    // dentro, faz a assinatura PARAR de ser removida e vazar crua em toda
    // prévia do inbox. O limite é regra de negócio, não capricho de tela.
    if (nome.length > 40) return { ok: false, erro: "O nome deve ter até 40 caracteres." };
    if (nome.includes("*") || /[\n\r]/.test(nome)) {
      return { ok: false, erro: "O nome não pode conter * nem quebra de linha." };
    }
    patch.nome = nome;
  }

  if ("telefone_dono" in entrada) {
    const cru = String(entrada.telefone_dono ?? "").replace(/\D/g, "");
    if (!cru) patch.telefone_dono = null;
    else if (cru.length < 10 || cru.length > 15) {
      return { ok: false, erro: "Telefone inválido (use DDI + DDD + número)." };
    } else patch.telefone_dono = cru;
  }

  if ("instancia_whatsapp" in entrada) {
    const v = String(entrada.instancia_whatsapp ?? "").trim();
    if (!v) return { ok: false, erro: "A instância não pode ficar vazia." };
    if (v.length > 60 || !/^[A-Za-z0-9_.-]+$/.test(v)) {
      return {
        ok: false,
        erro: "Instância inválida (só letras, números, ponto, hífen e _, até 60 caracteres).",
      };
    }
    patch.instancia_whatsapp = v;
  }

  if ("ativo" in entrada) {
    if (typeof entrada.ativo !== "boolean") {
      return { ok: false, erro: "O campo ativo deve ser verdadeiro ou falso." };
    }
    patch.ativo = entrada.ativo;
  }

  if (!Object.keys(patch).length) return { ok: false, erro: "Nada para alterar." };
  return { ok: true, patch };
}

export type ResultadoUpdate =
  | { ok: true; consultor: Consultor }
  | { ok: false; erro: string; status: number };

export async function atualizarConsultor(
  slug: string,
  patch: PatchConsultor,
): Promise<ResultadoUpdate> {
  const alvo = (slug ?? "").trim();
  if (!alvo) return { ok: false, erro: "Consultor não informado.", status: 400 };

  try {
    const supabase = getClient();

    // Desativar o último ativo deixaria o bot sem canal nenhum: o lookup de
    // vendedores filtra por `ativo` e cairia no fallback pra sempre.
    if (patch.ativo === false) {
      const { data: ativos } = await supabase
        .from("vendedores")
        .select("slug")
        .eq("ativo", true);
      const restantes = ((ativos ?? []) as { slug: string }[]).filter((v) => v.slug !== alvo);
      if (!restantes.length) {
        return {
          ok: false,
          erro: "Este é o último consultor ativo — desativá-lo deixaria o bot sem número.",
          status: 409,
        };
      }
    }

    // `.select()` é obrigatório: sem ele, um UPDATE que não afeta linha nenhuma
    // (RLS sem service_role, ou slug inexistente) volta SEM erro e o painel
    // diria "salvo" sem ter salvo nada.
    const { data, error } = await supabase
      .from("vendedores")
      .update(patch)
      .eq("slug", alvo)
      .select(COLS);

    if (error) return { ok: false, erro: error.message, status: 500 };
    const linha = ((data ?? []) as unknown as Consultor[])[0];

    // Desativar o consultor tira o acesso ao painel junto. Sem isto ele
    // continuaria entrando pelo magic link como se nada tivesse mudado —
    // `emailAutorizado` só olha dashboard_usuarios.ativo.
    if (linha && patch.ativo !== undefined) {
      const cascata = await supabase
        .from("dashboard_usuarios")
        .update({ ativo: patch.ativo })
        .eq("vendedor_slug", alvo);
      if (cascata.error) {
        console.error("[consultores] cascata dashboard_usuarios:", cascata.error.message);
      }
    }
    if (!linha) {
      return {
        ok: false,
        erro: "Nada foi alterado — consultor inexistente ou sem permissão de escrita no banco.",
        status: 404,
      };
    }
    return { ok: true, consultor: linha };
  } catch (e) {
    return {
      ok: false,
      erro: e instanceof Error ? e.message : "Falha ao salvar.",
      status: 500,
    };
  }
}
