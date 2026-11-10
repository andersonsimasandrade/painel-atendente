import { CONSULTORIOS, CREFITO, ORIENTACAO_ESTACIONAMENTO_CENTRO } from "@/lib/site";
import { formatarBR } from "@/lib/slots";

// Mensagem de confirmação de consulta enviada pelo painel.
// Primeira vez: se apresenta, traz os detalhes (dia, horário de início e fim, local completo, duração, o que levar) e termina
// com uma chamada para a ação (responder CONFIRMO + uma pergunta aberta), para a conversa começar aquecida.
// Quem já é paciente: versão curta, também com a chamada para confirmar.
// Em todas as versões o local já vai completo: nome do espaço, endereço e link do Google Maps (evita o "mas onde é?").

const p2 = (n: number) => String(n).padStart(2, "0");

function hora(iso: string, somarMin = 0): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000 + somarMin * 60 * 1000);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

export function textoConfirmacao(o: {
  nome: string | null;
  iso: string;
  local: "capoeiras" | "centro";
  primeiraVez: boolean;
  duracaoMin?: number;
  remarcada?: boolean; // consulta trocada de dia/horário: texto de "nova data"
}): string {
  const dur = o.duracaoMin && o.duracaoMin > 0 ? o.duracaoMin : 60;
  const cons = CONSULTORIOS[o.local];
  const primeiro = o.nome ? o.nome.trim().split(/\s+/)[0] : "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const quando = formatarBR(o.iso);
  const faixa = `das ${hora(o.iso)} às ${hora(o.iso, dur)}`;
  const estac = o.local === "centro" ? `${ORIENTACAO_ESTACIONAMENTO_CENTRO}\n` : "";
  const lugar =
    `📍 *${cons.nome}* (${cons.complemento})\n` +
    `${cons.linhaEndereco}\n` +
    `🗺 Google Maps: ${cons.mapaUrl}\n`;

  if (o.remarcada) {
    return (
      `${ola} Pronto, a sua consulta foi remarcada! 😊\n\n` +
      `📅 *Nova data:* *${quando}* (${faixa})\n` +
      lugar +
      estac +
      `\n` +
      `✅ Responda *CONFIRMO* para garantir o novo horário. No dia da consulta, eu te mando um lembrete. Se precisar mudar de novo, é só me avisar com 48 horas de antecedência.`
    );
  }
  if (!o.primeiraVez) {
    return (
      `${ola} Sua consulta está agendada! 😊\n\n` +
      `📅 *${quando}* (${faixa})\n` +
      lugar +
      estac +
      `\n` +
      `✅ Responda *CONFIRMO* para garantir o seu horário. Se precisar remarcar, é só me avisar com 48 horas de antecedência.`
    );
  }
  return (
    `${ola} Aqui é o Anderson Andrade, fisioterapeuta (${CREFITO}), em Florianópolis. 😊\n` +
    `Reservei a sua consulta:\n\n` +
    `📅 *${quando}* (${faixa})\n` +
    lugar +
    estac +
    `\n` +
    `A sessão dura ${dur} minutos, é individual e reúne a avaliação do seu quadro e as técnicas manuais na mesma hora. ` +
    `Se tiver exames, leve, e use roupa confortável e folgada.\n\n` +
    `✅ Responda *CONFIRMO* para garantir o seu horário (para remarcar, é só avisar com 48 horas de antecedência).\n` +
    `Para eu já te receber com atenção: o que mais tem te incomodado e há quanto tempo?`
  );
}
