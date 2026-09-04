// Configuração do painel — SOMENTE no servidor.
//
// Regra desta base de código: NENHUM valor de infraestrutura (URL de banco,
// domínio, instância do WhatsApp, remetente de e-mail) tem valor padrão
// embutido. Se faltar, o painel FALA que faltou, com o nome da variável.
// Um padrão silencioso é pior do que um erro: o sistema parece funcionar
// enquanto conversa com a instalação errada.
//
// Todas as leituras acontecem DENTRO de funções, nunca no topo do módulo —
// assim `next build` roda numa máquina sem nenhuma variável configurada
// (é o caso do build do Docker) e a cobrança só acontece em tempo de uso.

/** Lê uma variável obrigatória. Sem ela, erro legível apontando o .env.example. */
export function envObrigatoria(nome: string, valor: string | undefined): string {
  const v = (valor ?? "").trim();
  if (!v) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${nome}. ` +
        `Veja painel-atendente/.env.example para saber o que colocar nela.`,
    );
  }
  return v;
}

/** Lista separada por vírgula ("a, b ,c" -> ["a","b","c"]). Vazio -> []. */
export function envLista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nome da sua empresa. Aparece no cabeçalho, nos rodapés, nos e-mails e nos
 *  prompts de IA. É o único texto de marca do painel. */
export function empresaNome(): string {
  return (process.env.EMPRESA_NOME ?? "").trim() || "Sua Empresa";
}

// ── Alertas operacionais ──────────────────────────────────────────────────
// Para quem o painel avisa quando o WhatsApp cai, quando sai o resumo do dia
// e quando chega o relatório de tráfego. Vazio = ninguém é avisado (o painel
// segue funcionando; só não manda aviso).
//   ALERTAS_WHATSAPP=5511999998888,5511988887777
//   ALERTAS_EMAIL=voce@suaempresa.com.br,socio@suaempresa.com.br
export interface Destinatario {
  nome: string;
  whatsapp: string | null;
  email: string | null;
}

export function destinatariosAlerta(): Destinatario[] {
  const zaps = envLista(process.env.ALERTAS_WHATSAPP).map((t) => t.replace(/\D/g, ""));
  const mails = envLista(process.env.ALERTAS_EMAIL);
  const n = Math.max(zaps.length, mails.length);
  const out: Destinatario[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      nome: `Responsável ${i + 1}`,
      whatsapp: zaps[i] || null,
      email: mails[i] || null,
    });
  }
  return out;
}

/** Instância da Evolution usada para MANDAR alertas.
 *
 *  Se você tiver um segundo número só para avisos, coloque em
 *  EVOLUTION_INSTANCE_ALERTAS. Isso importa: o aviso mais útil é "o WhatsApp
 *  caiu" — e quem caiu foi justamente a instância principal, que não consegue
 *  avisar ninguém. Com um número só, configure ALERTAS_EMAIL. */
export function instanciaAlertas(): string {
  return (
    (process.env.EVOLUTION_INSTANCE_ALERTAS ?? "").trim() ||
    (process.env.EVOLUTION_INSTANCE ?? "").trim()
  );
}
