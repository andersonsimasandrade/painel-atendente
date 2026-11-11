// Envio da devolutiva por WhatsApp: (a) em DUAS mensagens (dados da sessão + link; passo a passo para salvar/imprimir) ou
// (b) o próprio PDF, sem link e sem senha. Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import { canalDaConversa } from "./consultores";
import { enviarPartes, registrarNaConversa } from "./confirmacao-envio";
import { enviarMidiaWhatsApp } from "./evolution";
import { gerarPdfDevolutiva } from "./devolutiva-pdf";
import { CONSULTORIOS, SITE_URL } from "./site";
import { nascimentoDoPaciente, salvarNascimento, marcarDevolutivaEnviada, devolutivaDoPainel, assinaturaProfissional } from "./devolutivas";
import { nascimentoIso } from "./devolutiva-acesso";

type R = { ok: true; enviadas: number } | { ok: false; error: string; precisaNascimento?: boolean };

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opts });

/** "Olá, Nome! Segue a devolutiva da sua sessão do dia 11/11/2026, às 15h, com o Dr. Anderson, no Consultório Capoeiras." */
function abertura(o: { nome: string | null; sessaoEm: string | null; dataSessao: string | null; local: string | null }): string {
  let quando = "";
  if (o.sessaoEm) {
    const dia = fmt(o.sessaoEm, { day: "2-digit", month: "2-digit", year: "numeric" });
    const [h, m] = fmt(o.sessaoEm, { hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
    quando = ` do dia ${dia}, às ${h}h${m === "00" ? "" : m}`;
  } else if (o.dataSessao) {
    const [a, mm, d] = o.dataSessao.split("-");
    quando = ` do dia ${d}/${mm}/${a}`;
  }
  const local = o.local === "capoeiras" || o.local === "centro" ? CONSULTORIOS[o.local].nome : null;
  return `Olá${o.nome ? `, ${o.nome}` : ""}! Segue a devolutiva da sua sessão${quando}, com o Dr. Anderson${local ? `, no ${local}` : ""}. 🙂`;
}

export function partesDevolutiva(o: { nome: string | null; link: string; sessaoEm: string | null; dataSessao: string | null; local: string | null }): string[] {
  const primeira = [abertura(o), "", "Por segurança, o documento é protegido: para abrir, digite a sua data de nascimento (dia, mês e ano).", "", o.link].join("\n");
  const segunda = [
    "Como salvar ou imprimir a sua devolutiva:",
    "",
    "1️⃣ Toque no link da mensagem anterior e digite a sua data de nascimento.",
    "2️⃣ Role até o final do documento e toque em “Salvar em PDF / imprimir”.",
    "3️⃣ Na tela que abrir, em “Destino”, escolha “Salvar como PDF” (para guardar) ou a sua impressora (para imprimir). No celular, escolha “Salvar como PDF” ou “Compartilhar”.",
    "",
    "Pode mostrar o PDF a outros profissionais que cuidam de você. Qualquer dúvida, me chame por aqui.",
  ].join("\n");
  return [primeira, segunda];
}

export async function enviarDevolutivaWhatsApp(telefone: string, id: string, nascimento?: string): Promise<R> {
  const sb = getClient();
  const r = await sb.from("devolutivas").select("*").eq("id", id).in("telefone", variantesTelefone(telefone)).limit(1);
  const row = r.data?.[0] as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: "Devolutiva não encontrada." };
  if (row.ativa === false) return { ok: false, error: "O link está encerrado. Reabra antes de enviar." };
  const tel = String(row.telefone);

  // A data de nascimento é a "senha" do documento: sem ela cadastrada, o link não abre.
  if (!(await nascimentoDoPaciente(tel))) {
    const iso = nascimentoIso(nascimento ?? "");
    if (!iso) return { ok: false, error: "Informe a data de nascimento do paciente: é a senha para abrir o link.", precisaNascimento: true };
    await salvarNascimento(tel, iso);
  }

  const c = await sb.from("ff_contatos").select("nome").eq("telefone", tel).limit(1);
  const nomeCru = ((c.data?.[0] as { nome?: string | null } | undefined)?.nome ?? "").trim().split(/\s+/)[0];
  const nome = nomeCru ? nomeCru.charAt(0).toUpperCase() + nomeCru.slice(1).toLowerCase() : null;

  const partes = partesDevolutiva({
    nome,
    link: `${SITE_URL}/devolutiva/${String(row.codigo)}`,
    sessaoEm: (row.sessao_em as string | null) ?? null,
    dataSessao: (row.data_sessao as string | null) ?? null,
    local: (row.local as string | null) ?? null,
  });
  const canal = await canalDaConversa(tel);
  const envio = await enviarPartes(canal.instancia, tel, partes);
  if (envio.enviadas.length) await registrarNaConversa(tel, envio.enviadas, "painel");
  if (!envio.ok) return { ok: false, error: envio.erro ?? "Não consegui enviar pelo WhatsApp." };
  await marcarDevolutivaEnviada(tel, id);
  return { ok: true, enviadas: envio.enviadas.length };
}

/** PDF da devolutiva (para baixar no painel ou mandar pelo WhatsApp). */
export async function pdfDaDevolutiva(
  telefone: string,
  id: string,
): Promise<{ ok: true; bytes: Uint8Array; arquivo: string; nome: string | null; sessaoEm: string | null; dataSessao: string | null; local: string | null; telefone: string } | { ok: false; error: string }> {
  const r = await devolutivaDoPainel(id);
  if (!r || !variantesTelefone(telefone).includes(r.telefone)) return { ok: false, error: "Devolutiva não encontrada." };
  const bytes = await gerarPdfDevolutiva(r.doc, await assinaturaProfissional());
  const arquivo = `Devolutiva${r.doc.primeiroNome ? ` - ${r.doc.primeiroNome}` : ""} - ${(r.doc.data_sessao ?? r.doc.criado_em).slice(0, 10)}.pdf`;
  return { ok: true, bytes, arquivo, nome: r.doc.primeiroNome, sessaoEm: r.doc.sessao_em, dataSessao: r.doc.data_sessao, local: r.doc.local, telefone: r.telefone };
}

/** Manda o PDF direto no WhatsApp, sem link e sem senha. */
export async function enviarDevolutivaPdf(telefone: string, id: string): Promise<R> {
  const p = await pdfDaDevolutiva(telefone, id);
  if (!p.ok) return p;
  const caption = `${abertura({ nome: p.nome, sessaoEm: p.sessaoEm, dataSessao: p.dataSessao, local: p.local })}\nPode salvar e mostrar a outros profissionais que cuidam de você. Qualquer dúvida, me chame por aqui.`;
  const canal = await canalDaConversa(p.telefone);
  const e = await enviarMidiaWhatsApp(p.telefone, { mediatype: "document", mimetype: "application/pdf", media: Buffer.from(p.bytes).toString("base64"), fileName: p.arquivo, caption }, canal.instancia);
  if (!e.ok) return { ok: false, error: e.error ?? "Não consegui enviar o PDF pelo WhatsApp." };
  await registrarNaConversa(p.telefone, [`📄 ${p.arquivo}\n${caption}`], "painel");
  await marcarDevolutivaEnviada(p.telefone, id);
  return { ok: true, enviadas: 1 };
}
