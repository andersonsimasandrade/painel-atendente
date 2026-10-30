import { CONSULTORIOS, CREFITO, ORIENTACAO_ESTACIONAMENTO_CENTRO } from "@/lib/site";
import { formatarBR } from "@/lib/slots";

// Mensagem de confirmação de consulta enviada pelo painel.
// Primeira vez: se apresenta, traz os detalhes (dia, horário de início e fim, endereço, duração, o que levar) e termina
// com uma chamada para a ação (responder CONFIRMO + uma pergunta aberta), para a conversa começar aquecida.
// Quem já é paciente: versão curta, também com a chamada para confirmar.

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
}): string {
  const dur = o.duracaoMin && o.duracaoMin > 0 ? o.duracaoMin : 60;
  const cons = CONSULTORIOS[o.local];
  const primeiro = o.nome ? o.nome.trim().split(/\s+/)[0] : "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const quando = formatarBR(o.iso);
  const faixa = `das ${hora(o.iso)} às ${hora(o.iso, dur)}`;
  const estac = o.local === "centro" ? `${ORIENTACAO_ESTACIONAMENTO_CENTRO}\n` : "";

  if (!o.primeiraVez) {
    return (
      `${ola} Sua próxima consulta está agendada para *${quando}* (${faixa}), no ${cons.nome}.\n` +
      `📍 ${cons.linhaEndereco}\n` +
      estac +
      `\n` +
      `✅ Responda *CONFIRMO* para garantir o seu horário. Se precisar remarcar, é só me avisar com 48 horas de antecedência. 😊`
    );
  }
  return (
    `${ola} Aqui é o Anderson Andrade, fisioterapeuta (${CREFITO}), em Florianópolis. 😊\n` +
    `Reservei a sua consulta:\n\n` +
    `📅 *${quando}* (${faixa})\n` +
    `📍 *${cons.nome}*\n` +
    `${cons.linhaEndereco}\n` +
    estac +
    `\n` +
    `A sessão dura ${dur} minutos, é individual e reúne a avaliação do seu quadro e as técnicas manuais na mesma hora. ` +
    `Se tiver exames, leve, e use roupa confortável e folgada.\n\n` +
    `✅ Responda *CONFIRMO* para garantir o seu horário (para remarcar, é só avisar com 48 horas de antecedência).\n` +
    `Para eu já te receber com atenção: o que mais tem te incomodado e há quanto tempo?`
  );
}
