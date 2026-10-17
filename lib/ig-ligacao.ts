import { getClient } from "@/lib/db";
import { soDigitos, variantesTelefone } from "@/lib/telefone";

// Liga a conversa do Instagram ao cadastro do WhatsApp da mesma pessoa.
// Depois da ligação:
//   • ig_contatos.telefone aponta para o WhatsApp
//   • ff_contatos.ig_id aponta para o Instagram (o Lead 360 mostra a conversa do Instagram)
//   • o nome (e a observação) do Instagram passam para o cadastro do WhatsApp, que o robô do WhatsApp já lê.
// Nunca apaga nada e nunca sobrescreve um nome que a pessoa já tenha no cadastro.

export function normalizarWhatsapp(bruto: string): string | null {
  let d = soDigitos(bruto);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export interface ResultadoLigacao {
  ok: boolean;
  telefone?: string;
  criouCadastro?: boolean;
  erro?: string;
}

export async function ligarInstagramAoWhatsApp(igId: string, whatsappBruto: string): Promise<ResultadoLigacao> {
  const tel = normalizarWhatsapp(whatsappBruto);
  if (!tel) return { ok: false, erro: "Número inválido. Use DDD + número (ex.: 48 99999-9999)." };
  const sb = getClient();

  const ig = await sb.from("ig_contatos").select("ig_id, username, nome, obs, estagio, cidade").eq("ig_id", igId).limit(1);
  const c = (ig.data?.[0] ?? null) as { ig_id: string; username: string | null; nome: string | null; obs: string | null; estagio: string | null; cidade: string | null } | null;
  if (!c) return { ok: false, erro: "Conversa do Instagram não encontrada." };

  const achado = await sb.from("ff_contatos").select("telefone, nome, observacoes, ig_id, cidade").in("telefone", variantesTelefone(tel)).limit(1);
  const atual = (achado.data?.[0] ?? null) as { telefone: string; nome: string | null; observacoes: string | null; ig_id: string | null; cidade: string | null } | null;

  // Esse WhatsApp já está ligado a OUTRA conta de Instagram? Não troca sem querer.
  if (atual?.ig_id && atual.ig_id !== igId) {
    return { ok: false, erro: "Esse WhatsApp já está ligado a outro perfil do Instagram." };
  }

  const nota = [
    `Veio pelo Instagram${c.username ? ` (@${c.username})` : ""}.`,
    c.obs ? `Resumo do robô: ${c.obs}` : "",
    c.estagio ? `Situação: ${c.estagio}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  let criou = false;
  let telefoneFinal = tel;
  if (atual) {
    telefoneFinal = atual.telefone;
    const upd: Record<string, unknown> = { ig_id: igId };
    if (!atual.nome && c.nome) upd.nome = c.nome;
    if (!atual.cidade && c.cidade) upd.cidade = c.cidade;
    if (!(atual.observacoes ?? "").includes("Veio pelo Instagram")) {
      upd.observacoes = [atual.observacoes, nota].filter(Boolean).join("\n");
    }
    const r = await sb.from("ff_contatos").update(upd).eq("telefone", atual.telefone);
    if (r.error) return { ok: false, erro: r.error.message };
  } else {
    const r = await sb.from("ff_contatos").insert({
      telefone: tel,
      nome: c.nome,
      cidade: c.cidade,
      observacoes: nota,
      ig_id: igId,
      ultima_instancia: (process.env.EVOLUTION_INSTANCE ?? "").trim() || null,
    });
    if (r.error) return { ok: false, erro: r.error.message };
    criou = true;
  }
  const u = await sb.from("ig_contatos").update({ telefone: telefoneFinal, whatsapp: telefoneFinal }).eq("ig_id", igId);
  if (u.error) return { ok: false, erro: u.error.message };
  return { ok: true, telefone: telefoneFinal, criouCadastro: criou };
}
