// CADASTRO PELO PACIENTE: o paciente preenche os próprios dados num link privado (nome completo, e-mail, telefone, nascimento, CPF
// e endereço) e eles já entram no cadastro do lead; o Anderson só confere. Server-only.
import { randomBytes } from "node:crypto";
import { addNota, getClient, setNomeLead } from "./db";
import { variantesTelefone } from "./telefone";
import { canalDaConversa } from "./consultores";
import { enviarTextoInstancia } from "./evolution";
import { registrarNaConversa } from "./confirmacao-envio";
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

/** Para a página pública: o link vale? (devolve só os 4 últimos dígitos do telefone, para o paciente confirmar). */
export async function conviteValido(codigo: string): Promise<{ finalTelefone: string } | null> {
  const c = await conviteAberto(codigo);
  return c ? { finalTelefone: c.telefone.replace(/\D/g, "").slice(-4) } : null;
}

export async function salvarCadastro(codigo: string, d: Partial<DadosCadastro>): Promise<R> {
  const c = await conviteAberto(codigo);
  if (!c) return { ok: false, error: "Este link já foi usado ou venceu. Peça um novo ao Anderson." };

  const nome = t(d.nome, 80);
  if (nome.split(" ").filter((p) => p.length > 1).length < 2) return { ok: false, error: "Escreva o nome completo (nome e sobrenome)." };
  const email = t(d.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
  const nasc = nascimentoIso(String(d.nascimento ?? ""));
  if (!nasc) return { ok: false, error: "Data de nascimento inválida (dia, mês e ano)." };
  const cpf = String(d.cpf ?? "").replace(/\D/g, "");
  if (!cpfValido(cpf)) return { ok: false, error: "CPF inválido. Confira os 11 números." };
  const cep = String(d.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return { ok: false, error: "CEP inválido (8 números)." };
  const logradouro = t(d.logradouro, 140);
  const numero = t(d.numero, 12);
  const bairro = t(d.bairro, 80);
  const cidade = t(d.cidade, 80);
  const uf = t(d.uf, 2).toUpperCase();
  if (!logradouro || !numero || !cidade || !/^[A-Z]{2}$/.test(uf)) return { ok: false, error: "Complete o endereço: rua, número, cidade e estado." };
  if (d.aceite !== true) return { ok: false, error: "Marque a autorização para usarmos os dados no seu atendimento." };
  const outro = String(d.telefoneOutro ?? "").replace(/\D/g, "");
  if (d.telefoneOk === false && outro.length < 10) return { ok: false, error: "Informe o telefone correto, com DDD." };

  const sb = getClient();
  const agora = new Date().toISOString();
  const up = await sb
    .from("ff_contatos")
    .update({
      email,
      data_nascimento: nasc,
      cnpj_numero: cpf,
      cnpj: true,
      cep,
      logradouro,
      numero,
      complemento: t(d.complemento, 60) || null,
      bairro: bairro || null,
      cidade,
      uf,
      cadastro_pelo_paciente_em: agora,
      cadastro_conferido_em: null,
    })
    .in("telefone", variantesTelefone(c.telefone))
    .select("telefone");
  if (up.error) return { ok: false, error: "Não consegui salvar agora. Tente de novo em instantes." };
  if (!up.data?.length) return { ok: false, error: "Cadastro não encontrado. Fale com o Anderson." };

  await setNomeLead(c.telefone, nome); // o nome completo vale também na agenda e nos contatos do Google
  if (d.telefoneOk === false) await addNota(c.telefone, "Cadastro (paciente)", `O paciente informou outro telefone para contato: ${outro}. Confira antes de usar.`);
  await sb.from("cadastro_convites").update({ usado_em: agora }).eq("id", c.id);
  return { ok: true };
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
  const texto =
    `Olá${nome ? `, ${nome}` : ""}! Para agilizar o seu atendimento e a emissão dos seus documentos e recibos, preencha o seu cadastro (leva uns 2 minutos):\n\n` +
    "Peço nome completo, e-mail, data de nascimento, CPF e endereço. Os dados ficam só comigo, protegidos pela LGPD, e o link vale por 7 dias.\n\n" +
    `${SITE_URL}/cadastro/${codigo}`;
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
