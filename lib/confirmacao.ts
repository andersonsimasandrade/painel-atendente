import { CONSULTORIOS, CREFITO, ORIENTACAO_ESTACIONAMENTO_CENTRO } from "@/lib/site";
import { formatarBR } from "@/lib/slots";

// Confirmação de consulta enviada pelo painel e pelo robô, em DUAS mensagens curtas (nada de mensagem gigante):
//   1ª) o aviso e o pedido de confirmação: data e horário em parágrafos separados, e o CONFIRMO.
//   2ª) logo depois, as informações para chegar: data e horário, o local (nome do espaço e endereço),
//       a orientação de estacionamento (Centro) e, por último, o link do Google Maps.
// Primeira vez: a 1ª mensagem se apresenta e conta o que esperar da sessão.

const p2 = (n: number) => String(n).padStart(2, "0");

function hora(iso: string, somarMin = 0): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000 + somarMin * 60 * 1000);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

interface Dados {
  nome: string | null;
  iso: string;
  local: "capoeiras" | "centro";
  primeiraVez: boolean;
  duracaoMin?: number;
  remarcada?: boolean; // consulta trocada de dia/horário: texto de "nova data"
}

/** As mensagens de confirmação, na ordem de envio. */
export function partesConfirmacao(o: Dados): string[] {
  const dur = o.duracaoMin && o.duracaoMin > 0 ? o.duracaoMin : 60;
  const cons = CONSULTORIOS[o.local];
  const primeiro = o.nome ? o.nome.trim().split(/\s+/)[0] : "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const completo = formatarBR(o.iso); // "quinta, 19/11, às 14:00"
  const dia = completo.split(", às")[0];
  const inicio = hora(o.iso);
  const faixa = `das ${inicio} às ${hora(o.iso, dur)}`;

  const bloco =
    `📅 *${o.remarcada ? "Nova data: " : ""}${dia}*\n\n` + // data
    `🕑 *${faixa}*`; // horário, em outro parágrafo

  let primeira: string;
  if (o.remarcada) {
    primeira =
      `${ola} Pronto, a sua consulta foi remarcada! 😊\n\n` +
      `${bloco}\n\n` +
      `✅ Responda *CONFIRMO* para garantir o novo horário. No dia da consulta, eu te mando um lembrete. Se precisar mudar de novo, é só me avisar com 48 horas de antecedência.`;
  } else if (!o.primeiraVez) {
    primeira =
      `${ola} Sua consulta está agendada! 😊\n\n` +
      `${bloco}\n\n` +
      `✅ Responda *CONFIRMO* para garantir o seu horário. Se precisar remarcar, é só me avisar com 48 horas de antecedência.`;
  } else {
    primeira =
      `${ola} Aqui é o Anderson Andrade, fisioterapeuta (${CREFITO}), em Florianópolis. 😊\n\n` +
      `Reservei a sua consulta:\n\n` +
      `${bloco}\n\n` +
      `A sessão dura ${dur} minutos, é individual e reúne a avaliação do seu quadro e as técnicas manuais na mesma hora. ` +
      `Se tiver exames, leve, e use roupa confortável e folgada.\n\n` +
      `✅ Responda *CONFIRMO* para garantir o seu horário (para remarcar, é só avisar com 48 horas de antecedência).\n\n` +
      `Para eu já te receber com atenção: o que mais tem te incomodado e há quanto tempo?`;
  }

  const segunda =
    `📅 *${dia}, às ${inicio}*\n\n` +
    `📍 *${cons.nome}* (${cons.complemento})\n${cons.linhaEndereco}\n\n` +
    (o.local === "centro" ? `${ORIENTACAO_ESTACIONAMENTO_CENTRO}\n\n` : "") +
    `🗺 Google Maps:\n${cons.mapaUrl}`;

  return [primeira, segunda];
}

/** Texto único (para registros): as mensagens juntas, uma depois da outra. */
export function textoConfirmacao(o: Dados): string {
  return partesConfirmacao(o).join("\n\n");
}
