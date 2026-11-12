// ASAAS (cobrança): este módulo SÓ cria cliente, cria/ajusta/cancela cobrança e lê o status. Não existe, e não deve existir, nenhuma
// chamada de transferência, saque, Pix de saída ou pagamento de contas: a barreira em `chamar` recusa qualquer outro endereço da API.
// A chave fica em variável de ambiente (nunca no código). Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { cpfValido } from "./cadastro";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const base = () => ((process.env.ASAAS_AMBIENTE ?? "sandbox").toLowerCase().startsWith("prod") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

export const asaasConfigurado = () => !!(process.env.ASAAS_API_KEY ?? "").trim();
/** A cobrança automática no agendamento só liga com chave + COBRANCA_AUTO=sim (nasce desligada). */
export const cobrancaAutomatica = () => asaasConfigurado() && (process.env.COBRANCA_AUTO ?? "").trim().toLowerCase() === "sim";
export const valorDaSessao = () => {
  const v = Number((process.env.VALOR_SESSAO ?? "250").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 250;
};

// Só estes caminhos existem para nós. Qualquer outro (transferências, etc.) é recusado antes de sair do servidor.
const PERMITIDO = /^\/(customers|payments)(\/[A-Za-z0-9_-]+)?(\?[A-Za-z0-9=&_.%-]*)?$/;

async function chamar<T>(metodo: "GET" | "POST" | "PUT" | "DELETE", caminho: string, corpo?: Record<string, unknown>): Promise<R<{ dados: T }>> {
  if (!PERMITIDO.test(caminho)) return { ok: false, error: "Chamada ao Asaas não permitida." };
  const chave = (process.env.ASAAS_API_KEY ?? "").trim();
  if (!chave) return { ok: false, error: "Asaas não configurado." };
  try {
    const r = await fetch(`${base()}${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", access_token: chave, "User-Agent": "painel-atendente" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as { errors?: { description?: string }[] } & Record<string, unknown>;
    if (!r.ok) return { ok: false, error: j.errors?.[0]?.description ?? `Asaas respondeu ${r.status}.` };
    return { ok: true, dados: j as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao falar com o Asaas." };
  }
}

const spDia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const hojeSP = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Cliente no Asaas (criado uma vez e guardado na ficha). Exige o CPF do cadastro. */
async function garantirCliente(telefone: string): Promise<R<{ cliente: string }>> {
  const sb = getClient();
  const r = await sb.from("ff_contatos").select("telefone, nome, email, cnpj_numero, cep, numero, complemento, asaas_customer_id").in("telefone", variantesTelefone(telefone)).limit(1);
  const c = r.data?.[0] as { telefone: string; nome: string | null; email: string | null; cnpj_numero: string | null; cep: string | null; numero: string | null; complemento: string | null; asaas_customer_id: string | null } | undefined;
  if (!c) return { ok: false, error: "Paciente não encontrado." };
  if (c.asaas_customer_id) return { ok: true, cliente: c.asaas_customer_id };
  const cpf = String(c.cnpj_numero ?? "").replace(/\D/g, "");
  if (!cpfValido(cpf)) return { ok: false, error: "Falta o CPF no cadastro do paciente." };
  if (!(c.nome ?? "").trim()) return { ok: false, error: "Falta o nome no cadastro do paciente." };
  const novo = await chamar<{ id: string }>("POST", "/customers", {
    name: c.nome!.trim(),
    cpfCnpj: cpf,
    email: (c.email ?? "").trim() || undefined,
    mobilePhone: c.telefone.replace(/^55/, "").slice(0, 11),
    postalCode: (c.cep ?? "").replace(/\D/g, "") || undefined,
    addressNumber: (c.numero ?? "").trim() || undefined,
    complement: (c.complemento ?? "").trim() || undefined,
    externalReference: c.telefone,
    notificationDisabled: true, // quem avisa o paciente é o WhatsApp do consultório, não o Asaas
  });
  if (!novo.ok) return novo;
  await sb.from("ff_contatos").update({ asaas_customer_id: novo.dados.id }).eq("telefone", c.telefone);
  return { ok: true, cliente: novo.dados.id };
}

export interface CobrancaSessao {
  id: string;
  link: string;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  jaExistia: boolean;
}

/** Cobrança da sessão (PIX ou cartão), vencendo no dia da sessão. Uma por agendamento (não duplica). */
export async function cobrarSessao(o: { agendamentoId: string; telefone: string; iso: string }): Promise<R<{ cobranca: CobrancaSessao }>> {
  if (!asaasConfigurado()) return { ok: false, error: "Asaas não configurado." };
  const sb = getClient();
  const ex = await sb.from("cobrancas").select("asaas_id, link, valor, vencimento, status").eq("agendamento_id", o.agendamentoId).neq("status", "CANCELADA").limit(1);
  const e = ex.data?.[0] as { asaas_id: string; link: string | null; valor: number; vencimento: string } | undefined;
  if (e?.link) return { ok: true, cobranca: { id: e.asaas_id, link: e.link, valor: Number(e.valor), vencimento: e.vencimento, jaExistia: true } };

  const cli = await garantirCliente(o.telefone);
  if (!cli.ok) return cli;
  const dia = spDia(o.iso);
  const venc = dia < hojeSP() ? hojeSP() : dia;
  const valor = valorDaSessao();
  const p = await chamar<{ id: string; invoiceUrl?: string; status?: string }>("POST", "/payments", {
    customer: cli.cliente,
    billingType: "UNDEFINED", // o paciente escolhe como pagar (PIX ou cartão) na página do Asaas
    value: valor,
    dueDate: venc,
    description: "Sessão de fisioterapia - Anderson Andrade",
    externalReference: o.agendamentoId,
  });
  if (!p.ok) return p;
  const link = p.dados.invoiceUrl ?? "";
  if (!link) return { ok: false, error: "O Asaas não devolveu o link de pagamento." };
  await sb.from("cobrancas").insert({ agendamento_id: o.agendamentoId, telefone: o.telefone, asaas_id: p.dados.id, valor, vencimento: venc, status: p.dados.status ?? "PENDING", link });
  return { ok: true, cobranca: { id: p.dados.id, link, valor, vencimento: venc, jaExistia: false } };
}

/** Sessão remarcada: o vencimento acompanha o novo dia (só se a cobrança ainda estiver aberta). */
export async function moverVencimento(agendamentoId: string, iso: string): Promise<void> {
  if (!asaasConfigurado()) return;
  const sb = getClient();
  const r = await sb.from("cobrancas").select("asaas_id, status").eq("agendamento_id", agendamentoId).eq("status", "PENDING").limit(1);
  const c = r.data?.[0] as { asaas_id: string } | undefined;
  if (!c) return;
  const dia = spDia(iso);
  const venc = dia < hojeSP() ? hojeSP() : dia;
  const u = await chamar("PUT", `/payments/${c.asaas_id}`, { dueDate: venc });
  if (u.ok) await sb.from("cobrancas").update({ vencimento: venc }).eq("asaas_id", c.asaas_id);
}

/** Sessão cancelada: cancela a cobrança aberta no Asaas. */
export async function cancelarCobranca(agendamentoId: string): Promise<void> {
  if (!asaasConfigurado()) return;
  const sb = getClient();
  const r = await sb.from("cobrancas").select("asaas_id").eq("agendamento_id", agendamentoId).eq("status", "PENDING").limit(1);
  const c = r.data?.[0] as { asaas_id: string } | undefined;
  if (!c) return;
  const d = await chamar("DELETE", `/payments/${c.asaas_id}`);
  if (d.ok) await sb.from("cobrancas").update({ status: "CANCELADA" }).eq("asaas_id", c.asaas_id);
}

const PAGOS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

/** Aviso do Asaas (webhook): atualiza o status e devolve o que aconteceu, para avisar o Anderson. */
export async function tratarEventoAsaas(corpo: { event?: string; payment?: { id?: string; status?: string } }): Promise<{ pago: boolean; telefone?: string; valor?: number; agendamentoId?: string | null } | null> {
  const ev = String(corpo.event ?? "");
  const id = String(corpo.payment?.id ?? "");
  if (!ev.startsWith("PAYMENT_") || !id) return null;
  const sb = getClient();
  const r = await sb.from("cobrancas").select("telefone, valor, status, agendamento_id").eq("asaas_id", id).limit(1);
  const c = r.data?.[0] as { telefone: string; valor: number; status: string; agendamento_id: string | null } | undefined;
  if (!c) return null;
  const pago = PAGOS.has(ev);
  const status = pago ? "RECEIVED" : ev === "PAYMENT_OVERDUE" ? "OVERDUE" : ev === "PAYMENT_DELETED" ? "CANCELADA" : (corpo.payment?.status ?? c.status);
  await sb.from("cobrancas").update({ status, ...(pago ? { pago_em: new Date().toISOString() } : {}) }).eq("asaas_id", id);
  return { pago: pago && c.status !== "RECEIVED", telefone: c.telefone, valor: Number(c.valor), agendamentoId: c.agendamento_id };
}
