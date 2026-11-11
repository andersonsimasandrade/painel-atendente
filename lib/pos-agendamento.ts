// FLUXO DEPOIS DE MARCAR A SESSÃO (robô ou painel):
//   1) o paciente recebe o passo a passo (cadastro → confirmação com local e orientações → sessão → devolutiva e acompanhamento)
//      junto com o link do cadastro;
//   2) a confirmação com local e orientações segue assim que ele preenche o cadastro (ou, no máximo, depois de 30 minutos;
//      se a sessão é em menos de 24 h, segue na hora, para ninguém ficar sem o endereço);
//   3) quem já tem cadastro completo recebe a confirmação direto, como antes. Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { canalDaConversa } from "./consultores";
import { enviarPartes, registrarNaConversa } from "./confirmacao-envio";
import { partesConfirmacao } from "./confirmacao";
import { criarConvite } from "./cadastro";
import { SITE_URL } from "./site";
import { formatarBR } from "./slots";

const ESPERA_MIN = 30;
const SEM_ESPERA_MS = 24 * 3600 * 1000;

/** Cadastro completo = CPF, data de nascimento e e-mail preenchidos (pelo paciente ou à mão). */
export async function cadastroCompleto(telefone: string): Promise<boolean> {
  const r = await getClient().from("ff_contatos").select("cnpj_numero, data_nascimento, email").in("telefone", variantesTelefone(telefone)).limit(1);
  const c = r.data?.[0] as { cnpj_numero: string | null; data_nascimento: string | null; email: string | null } | undefined;
  return !!c && String(c.cnpj_numero ?? "").replace(/\D/g, "").length === 11 && !!c.data_nascimento && !!(c.email ?? "").trim();
}

export function mensagemPassoAPasso(o: { nome: string | null; iso: string; link: string }): string {
  const primeiro = (o.nome ?? "").trim().split(/\s+/)[0];
  return [
    `Perfeito${primeiro ? `, ${primeiro}` : ""}! Localizei o seu horário: *${formatarBR(o.iso)}*. 😊`,
    "",
    "Veja como funciona daqui para frente:",
    "",
    "1️⃣ Agora preciso dos seus dados cadastrais (nome completo, e-mail, data de nascimento, CPF e endereço). Preencha por este link, leva uns 2 minutos:",
    o.link,
    "",
    "2️⃣ Assim que eu receber, te envio a confirmação do horário, com o local e as orientações.",
    "3️⃣ No dia e horário marcados, você vem e fazemos a sessão.",
    "4️⃣ Depois da sessão, preparo a devolutiva do seu caso e entro em contato para saber como está a sua evolução.",
    "",
    "Os seus dados ficam só comigo, protegidos pela LGPD.",
  ].join("\n");
}

interface Pedido {
  agendamentoId: string;
  telefone: string;
  nome: string | null;
  iso: string;
  local: "capoeiras" | "centro";
  primeiraVez: boolean;
  instancia?: string; // número que atende (padrão: o da conversa)
}

export interface ResultadoFluxo {
  confirmado: boolean; // a confirmação com local/orientações já foi enviada
  aguardandoCadastro: boolean;
  enviadas: string[]; // o que de fato foi ao paciente (para a conversa do painel)
  erro?: string;
}

export async function iniciarFluxoPosAgendamento(o: Pedido): Promise<ResultadoFluxo> {
  const canal = { instancia: o.instancia || (await canalDaConversa(o.telefone)).instancia };
  const confirmacao = () => partesConfirmacao({ nome: o.nome, iso: o.iso, local: o.local, primeiraVez: o.primeiraVez });

  if (await cadastroCompleto(o.telefone)) {
    const env = await enviarPartes(canal.instancia, o.telefone, confirmacao());
    return { confirmado: env.ok, aguardandoCadastro: false, enviadas: env.enviadas, erro: env.erro };
  }

  const convite = await criarConvite(o.telefone);
  if (!convite.ok) {
    // Sem o convite não dá para pedir os dados: segue só com a confirmação, como antes.
    const env = await enviarPartes(canal.instancia, o.telefone, confirmacao());
    return { confirmado: env.ok, aguardandoCadastro: false, enviadas: env.enviadas, erro: env.erro };
  }
  const passo = mensagemPassoAPasso({ nome: o.nome, iso: o.iso, link: `${SITE_URL}/cadastro/${convite.codigo}` });
  const urgente = new Date(o.iso).getTime() - Date.now() < SEM_ESPERA_MS;
  const env1 = await enviarPartes(canal.instancia, o.telefone, [passo]);
  if (!env1.ok) {
    const env = await enviarPartes(canal.instancia, o.telefone, confirmacao());
    return { confirmado: env.ok, aguardandoCadastro: false, enviadas: env.enviadas, erro: env1.erro };
  }
  if (urgente) {
    const env2 = await enviarPartes(canal.instancia, o.telefone, confirmacao());
    return { confirmado: env2.ok, aguardandoCadastro: false, enviadas: [...env1.enviadas, ...env2.enviadas], erro: env2.erro };
  }
  // Confirmação em espera: sai quando o cadastro chegar ou em 30 minutos.
  await getClient()
    .from("agendamentos")
    .update({ confirmacao_pendente_ate: new Date(Date.now() + ESPERA_MIN * 60 * 1000).toISOString() })
    .eq("id", o.agendamentoId);
  return { confirmado: false, aguardandoCadastro: true, enviadas: env1.enviadas };
}

interface Pendente {
  id: string;
  telefone_lead: string;
  data_hora: string;
  local: string | null;
  nome_lead: string | null;
}

async function enviarConfirmacaoPendente(a: Pendente): Promise<boolean> {
  const sb = getClient();
  // Trava: só quem conseguir limpar a marca envia (evita mensagem em dobro entre o relógio e o cadastro).
  const trava = await sb.from("agendamentos").update({ confirmacao_pendente_ate: null }).eq("id", a.id).not("confirmacao_pendente_ate", "is", null).select("id");
  if (!trava.data?.length) return false;
  const local = a.local === "centro" ? "centro" : "capoeiras";
  const v = variantesTelefone(a.telefone_lead);
  const [anteriores, c] = await Promise.all([
    sb.from("agendamentos").select("id", { count: "exact", head: true }).in("telefone_lead", v).neq("status", "cancelado").neq("id", a.id),
    sb.from("ff_contatos").select("nome").in("telefone", v).limit(1),
  ]);
  const nome = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? a.nome_lead) || null;
  const canal = await canalDaConversa(a.telefone_lead);
  const env = await enviarPartes(canal.instancia, a.telefone_lead, partesConfirmacao({ nome, iso: a.data_hora, local, primeiraVez: (anteriores.count ?? 0) === 0 }));
  if (env.enviadas.length) await registrarNaConversa(a.telefone_lead, env.enviadas, "robo-agenda");
  if (!env.ok) {
    // Não saiu: devolve a marca para o relógio tentar de novo.
    await sb.from("agendamentos").update({ confirmacao_pendente_ate: new Date().toISOString() }).eq("id", a.id);
    return false;
  }
  return true;
}

/** O cadastro chegou: libera as confirmações que estavam esperando por ele. */
export async function liberarConfirmacoes(telefone: string): Promise<number> {
  const r = await getClient()
    .from("agendamentos")
    .select("id, telefone_lead, data_hora, local, nome_lead")
    .in("telefone_lead", variantesTelefone(telefone))
    .not("confirmacao_pendente_ate", "is", null)
    .neq("status", "cancelado")
    .gt("data_hora", new Date().toISOString());
  let n = 0;
  for (const a of (r.data ?? []) as Pendente[]) if (await enviarConfirmacaoPendente(a)) n++;
  return n;
}

/** Relógio (a cada minuto): quem não preencheu o cadastro a tempo recebe a confirmação mesmo assim. */
export async function enviarConfirmacoesVencidas(): Promise<number> {
  const r = await getClient()
    .from("agendamentos")
    .select("id, telefone_lead, data_hora, local, nome_lead, status")
    .not("confirmacao_pendente_ate", "is", null)
    .lte("confirmacao_pendente_ate", new Date().toISOString())
    .limit(20);
  let n = 0;
  for (const a of (r.data ?? []) as (Pendente & { status: string })[]) {
    if (a.status === "cancelado" || new Date(a.data_hora).getTime() < Date.now()) {
      await getClient().from("agendamentos").update({ confirmacao_pendente_ate: null }).eq("id", a.id);
      continue;
    }
    if (await enviarConfirmacaoPendente(a)) n++;
  }
  return n;
}

const g = globalThis as unknown as { __confirmacoesRelogio?: boolean };
export function iniciarRelogioConfirmacoes() {
  if (g.__confirmacoesRelogio) return;
  g.__confirmacoesRelogio = true;
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const n = await enviarConfirmacoesVencidas();
      if (n) console.log("[confirmacoes] enviadas após espera do cadastro:", n);
    } catch (e) {
      console.error("[confirmacoes-relogio]", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  }, 60 * 1000);
}
