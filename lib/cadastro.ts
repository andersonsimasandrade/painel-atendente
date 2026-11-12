// CADASTRO PELO PACIENTE: o paciente preenche os próprios dados num link privado (nome completo, e-mail, telefone, nascimento, CPF
// e endereço) e eles já entram no cadastro do lead; o Anderson só confere. Server-only.
import { randomBytes } from "node:crypto";
import { addNota, getClient, setNomeLead } from "./db";
import { variantesTelefone } from "./telefone";
import { canalDaConversa } from "./consultores";
import { enviarTextoInstancia } from "./evolution";
import { enviarPartes, registrarNaConversa } from "./confirmacao-envio";
import { nascimentoIso } from "./devolutiva-acesso";
import { SITE_URL } from "./site";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const VALIDADE_CONVITE_MS = 7 * 24 * 3600 * 1000;

export function cpfValido(txt: string): boolean {
  const d = String(txt ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

export interface DadosCadastro {
  nome: string;
  email: string;
  nascimento: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefoneOk: boolean;
  telefoneOutro: string;
  aceite: boolean;
}

const t = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

async function conviteAberto(codigo: string): Promise<{ id: string; telefone: string } | null> {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(codigo)) return null;
  const r = await getClient().from("cadastro_convites").select("id, telefone, expira_em, usado_em").eq("codigo", codigo).limit(1);
  const c = r.data?.[0] as { id: string; telefone: string; expira_em: string; usado_em: string | null } | undefined;
  if (!c || c.usado_em || new Date(c.expira_em).getTime() < Date.now()) return null;
  return { id: c.id, telefone: c.telefone };
}

export type CampoCad = "nome" | "email" | "nascimento" | "cpf" | "endereco";
const ROTULOS: Record<CampoCad, string> = { nome: "nome completo", email: "e-mail", nascimento: "data de nascimento", cpf: "CPF", endereco: "endereço" };

/** O que ainda falta no cadastro do paciente (só isso é pedido: quem já tem os dados não preenche de novo). */
export async function camposFaltando(telefone: string): Promise<CampoCad[]> {
  const r = await getClient()
    .from("ff_contatos")
    .select("nome, email, data_nascimento, cnpj_numero, logradouro, numero, cidade, uf")
    .in("telefone", variantesTelefone(telefone))
    .limit(1);
  const c = r.data?.[0] as { nome: string | null; email: string | null; data_nascimento: string | null; cnpj_numero: string | null; logradouro: string | null; numero: string | null; cidade: string | null; uf: string | null } | undefined;
  if (!c) return ["nome", "email", "nascimento", "cpf", "endereco"];
  const falta: CampoCad[] = [];
  if ((c.nome ?? "").trim().split(/\s+/).filter((p) => p.length > 1).length < 2) falta.push("nome");
  if (!(c.email ?? "").trim()) falta.push("email");
  if (!c.data_nascimento) falta.push("nascimento");
  if (String(c.cnpj_numero ?? "").replace(/\D/g, "").length !== 11) falta.push("cpf");
  if (!(c.logradouro ?? "").trim() || !(c.numero ?? "").trim() || !(c.cidade ?? "").trim() || !(c.uf ?? "").trim()) falta.push("endereco");
  return falta;
}

const COM_ARTIGO: Record<CampoCad, string> = { nome: "do nome completo", email: "do e-mail", nascimento: "da data de nascimento", cpf: "do CPF", endereco: "do endereço" };

/** "dos seus dados (…)" quando falta tudo; senão "só da data de nascimento" (só o que falta). */
export function textoPedidoDados(falta: CampoCad[]): string {
  if (falta.length >= 5) return `dos seus dados (${falta.slice(0, -1).map((f) => ROTULOS[f]).join(", ")} e ${ROTULOS[falta[falta.length - 1]]})`;
  const itens = falta.map((f) => COM_ARTIGO[f]);
  return `só ${itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0]}`;
}

/** Para a página pública: o link vale? (devolve só os 4 últimos dígitos do telefone, para o paciente confirmar, e o que falta preencher). */
export async function conviteValido(codigo: string): Promise<{ finalTelefone: string; faltam: CampoCad[] } | null> {
  const c = await conviteAberto(codigo);
  return c ? { finalTelefone: c.telefone.replace(/\D/g, "").slice(-4), faltam: await camposFaltando(c.telefone) } : null;
}

export async function salvarCadastro(codigo: string, d: Partial<DadosCadastro>): Promise<R> {
  const c = await conviteAberto(codigo);
  if (!c) return { ok: false, error: "Este link já foi usado ou venceu. Peça um novo ao Anderson." };
  const faltam = await camposFaltando(c.telefone);
  const pede = (k: CampoCad) => faltam.includes(k);
  const patch: Record<string, unknown> = {};
  let nome: string | null = null;

  if (pede("nome")) {
    nome = t(d.nome, 80);
    if (nome.split(" ").filter((p) => p.length > 1).length < 2) return { ok: false, error: "Escreva o nome completo (nome e sobrenome)." };
  }
  if (pede("email")) {
    const email = t(d.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
    patch.email = email;
  }
  if (pede("nascimento")) {
    const nasc = nascimentoIso(String(d.nascimento ?? ""));
    if (!nasc) return { ok: false, error: "Data de nascimento inválida (dia, mês e ano)." };
    patch.data_nascimento = nasc;
  }
  if (pede("cpf")) {
    const cpf = String(d.cpf ?? "").replace(/\D/g, "");
    if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido. Confira os 11 números." };
    patch.cnpj_numero = cpf;
    patch.cnpj = true;
  }
  if (pede("endereco")) {
    const cep = String(d.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return { ok: false, error: "CEP inválido (8 números)." };
    const logradouro = t(d.logradouro, 140);
    const numero = t(d.numero, 12);
    const cidade = t(d.cidade, 80);
    const uf = t(d.uf, 2).toUpperCase();
    if (!logradouro || !numero || !cidade || !/^[A-Z]{2}$/.test(uf)) return { ok: false, error: "Complete o endereço: rua, número, cidade e estado." };
    Object.assign(patch, { cep, logradouro, numero, complemento: t(d.complemento, 60) || null, bairro: t(d.bairro, 80) || null, cidade, uf });
  }
  if (d.aceite !== true) return { ok: false, error: "Marque a autorização para usarmos os dados no seu atendimento." };
  const outro = String(d.telefoneOutro ?? "").replace(/\D/g, "");
  if (faltam.length >= 4 && d.telefoneOk === false && outro.length < 10) return { ok: false, error: "Informe o telefone correto, com DDD." };

  const sb = getClient();
  const agora = new Date().toISOString();
  const up = await sb
    .from("ff_contatos")
    .update({ ...patch, cadastro_pelo_paciente_em: agora, cadastro_conferido_em: null })
    .in("telefone", variantesTelefone(c.telefone))
    .select("telefone");
  if (up.error) return { ok: false, error: "Não consegui salvar agora. Tente de novo em instantes." };
  if (!up.data?.length) return { ok: false, error: "Cadastro não encontrado. Fale com o Anderson." };

  if (nome) await setNomeLead(c.telefone, nome); // o nome completo vale também na agenda e nos contatos do Google
  if (faltam.length >= 4 && d.telefoneOk === false) await addNota(c.telefone, "Cadastro (paciente)", `O paciente informou outro telefone para contato: ${outro}. Confira antes de usar.`);
  await sb.from("cadastro_convites").update({ usado_em: agora }).eq("id", c.id);
  await addNota(c.telefone, "Cadastro (paciente)", "✅ O paciente preencheu o cadastro pelo link. Confira os dados na ficha e clique em “Está tudo certo”.").catch(() => undefined);
  // Recibo pelo WhatsApp: o paciente vê os dados que mandou (duplo cheque) e sabe que chegaram. Vem ANTES da confirmação da sessão.
  try {
    const texto = await mensagemRecebimento(c.telefone, nome, patch);
    const canal = await canalDaConversa(c.telefone);
    const env = await enviarPartes(canal.instancia, c.telefone, [texto]);
    if (env.enviadas.length) await registrarNaConversa(c.telefone, env.enviadas, "sistema");
  } catch (e) {
    console.error("[cadastro] recibo ao paciente:", e);
  }
  // Se a confirmação da sessão estava esperando o cadastro, ela segue agora (com o local e as orientações).
  try {
    const { liberarConfirmacoes } = await import("./pos-agendamento");
    await liberarConfirmacoes(c.telefone);
  } catch (e) {
    console.error("[cadastro] liberar confirmação:", e);
  }
  return { ok: true };
}

/** Cria o convite do cadastro (vale 7 dias) e devolve o código do link. */
export async function criarConvite(telefone: string): Promise<R<{ codigo: string; id: string; telefone: string }>> {
  const ct = await getClient().from("ff_contatos").select("telefone").in("telefone", variantesTelefone(telefone)).limit(1);
  const real = (ct.data?.[0] as { telefone: string } | undefined)?.telefone;
  if (!real) return { ok: false, error: "Paciente não encontrado." };
  const codigo = randomBytes(12).toString("base64url");
  const ins = await getClient().from("cadastro_convites").insert({ telefone: real, codigo, expira_em: new Date(Date.now() + VALIDADE_CONVITE_MS).toISOString() }).select("id");
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, codigo, id: String((ins.data?.[0] as { id: string }).id), telefone: real };
}

/** Cria o convite (vale 7 dias) e envia o link por WhatsApp. */
export async function enviarConviteCadastro(telefone: string): Promise<R> {
  const sb = getClient();
  const ct = await sb.from("ff_contatos").select("telefone, nome").in("telefone", variantesTelefone(telefone)).limit(1);
  const c = ct.data?.[0] as { telefone: string; nome: string | null } | undefined;
  if (!c) return { ok: false, error: "Paciente não encontrado." };
  const codigo = randomBytes(12).toString("base64url");
  const ins = await sb.from("cadastro_convites").insert({ telefone: c.telefone, codigo, expira_em: new Date(Date.now() + VALIDADE_CONVITE_MS).toISOString() }).select("id");
  if (ins.error) return { ok: false, error: ins.error.message };
  const primeiro = (c.nome ?? "").trim().split(/\s+/)[0];
  const nome = primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : null;
  const falta = await camposFaltando(c.telefone);
  if (!falta.length) return { ok: false, error: "O cadastro deste paciente já está completo." };
  const texto = `Olá${nome ? `, ${nome}` : ""}! Para finalizar o seu cadastro, preciso ${textoPedidoDados(falta)}. Leva 2 minutos:\n${SITE_URL}/cadastro/${codigo}`;
  const canal = await canalDaConversa(c.telefone);
  const e = await enviarTextoInstancia(canal.instancia, c.telefone, texto);
  if (!e.ok) return { ok: false, error: e.error ?? "Não consegui enviar pelo WhatsApp." };
  await registrarNaConversa(c.telefone, [texto], "painel");
  await sb.from("cadastro_convites").update({ enviado_em: new Date().toISOString() }).eq("id", String((ins.data?.[0] as { id: string }).id));
  return { ok: true };
}

export interface StatusCadastro {
  nascimento: string | null;
  recebidoEm: string | null;
  conferidoEm: string | null;
  conviteEnviadoEm: string | null; // último convite ainda aberto
}

export async function statusCadastro(telefone: string): Promise<StatusCadastro> {
  const sb = getClient();
  const v = variantesTelefone(telefone);
  const [c, cv] = await Promise.all([
    sb.from("ff_contatos").select("data_nascimento, cadastro_pelo_paciente_em, cadastro_conferido_em").in("telefone", v).limit(1),
    sb.from("cadastro_convites").select("enviado_em, expira_em").in("telefone", v).is("usado_em", null).gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(1),
  ]);
  const r = c.data?.[0] as { data_nascimento: string | null; cadastro_pelo_paciente_em: string | null; cadastro_conferido_em: string | null } | undefined;
  return {
    nascimento: r?.data_nascimento ?? null,
    recebidoEm: r?.cadastro_pelo_paciente_em ?? null,
    conferidoEm: r?.cadastro_conferido_em ?? null,
    conviteEnviadoEm: ((cv.data?.[0] as { enviado_em: string | null } | undefined)?.enviado_em ?? null) || null,
  };
}

export async function marcarConferido(telefone: string): Promise<R> {
  const r = await getClient().from("ff_contatos").update({ cadastro_conferido_em: new Date().toISOString() }).in("telefone", variantesTelefone(telefone)).select("telefone");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Paciente não encontrado." };
}

export async function definirNascimento(telefone: string, txt: string): Promise<R> {
  const iso = txt.trim() ? nascimentoIso(txt) : null;
  if (txt.trim() && !iso) return { ok: false, error: "Data inválida (dd/mm/aaaa)." };
  const r = await getClient().from("ff_contatos").update({ data_nascimento: iso }).in("telefone", variantesTelefone(telefone)).select("telefone");
  if (r.error) return { ok: false, error: r.error.message };
  return r.data?.length ? { ok: true } : { ok: false, error: "Paciente não encontrado." };
}


const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Mensagem de recebimento: repete o que o paciente informou (CPF só com os 2 últimos dígitos) e pede o "OK" ou a correção. */
async function mensagemRecebimento(telefone: string, nomeInformado: string | null, patch: Record<string, unknown>): Promise<string> {
  const r = await getClient().from("ff_contatos").select("nome").in("telefone", variantesTelefone(telefone)).limit(1);
  const nomeAtual = nomeInformado ?? ((r.data?.[0] as { nome?: string | null } | undefined)?.nome ?? "");
  const primeiro = nomeAtual.trim().split(/\s+/)[0];
  const linhas: string[] = [];
  if (nomeInformado) linhas.push(`👤 ${nomeInformado}`);
  if (patch.email) linhas.push(`✉️ ${String(patch.email)}`);
  if (patch.data_nascimento) linhas.push(`🎂 ${dataBR(String(patch.data_nascimento))}`);
  if (patch.cnpj_numero) linhas.push(`🪪 CPF final ${String(patch.cnpj_numero).slice(-2)}`);
  if (patch.logradouro) {
    const compl = patch.complemento ? `, ${String(patch.complemento)}` : "";
    const bairro = patch.bairro ? ` — ${String(patch.bairro)}` : "";
    linhas.push(`📍 ${String(patch.logradouro)}, ${String(patch.numero)}${compl}${bairro}, ${String(patch.cidade)}/${String(patch.uf)}`);
  }
  return [
    `Recebi os seus dados${primeiro ? `, ${primeiro}` : ""}! ✅ Confira se está tudo certo:`,
    "",
    ...linhas,
    "",
    "Responda *OK* se estiver certo. Se precisar corrigir algo, é só me dizer por aqui.",
  ].join("\n");
}
