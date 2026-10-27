// HORÁRIOS EM QUE O ANDERSON ATENDE (usados nas sugestões de horário do painel e na página pública de agendamento).
//   • quarta: das 08:00 às 17:00 (pausa 12:00–13:30)
//   • quinta e sexta: manhã (08:00–12:00) e 13:30–17:00
//   • segunda e sábado: só de manhã (08:00–12:00), em semanas ALTERNADAS (semana sim, semana não)
//   • terça e domingo: não atende
// Cada atendimento dura 60 minutos. Funções puras, sem acesso a banco.
//
// >>> AJUSTE AQUI se a rotina mudar. SEMANA_REF é uma SEGUNDA-FEIRA em que segunda e sábado ESTÃO abertos;
//     a partir dela as semanas alternam (ela aberta, a seguinte fechada, e assim por diante). <<<
export const DURACAO_MIN = 60;
export const SEMANA_REF = "2026-11-02";

type Janela = [string, string]; // [início, fim]
interface Regra {
  alterna?: boolean;
  janelas: Janela[];
}

const MANHA_E_TARDE: Janela[] = [
  ["08:00", "12:00"],
  ["13:30", "17:00"],
];

export const REGRAS: Record<number, Regra> = {
  1: { alterna: true, janelas: [["08:00", "12:00"]] }, // segunda
  3: { janelas: MANHA_E_TARDE }, // quarta
  4: { janelas: MANHA_E_TARDE }, // quinta
  5: { janelas: MANHA_E_TARDE }, // sexta
  6: { alterna: true, janelas: [["08:00", "12:00"]] }, // sábado
};

const MS_DIA = 86400000;
const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Segunda-feira (UTC meia-noite) da semana de uma data AAAA-MM-DD. Domingo conta como o fim da semana anterior. */
function segundaDaSemana(dataIso: string): number {
  const d = new Date(`${dataIso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=dom
  const voltar = dow === 0 ? 6 : dow - 1;
  return d.getTime() - voltar * MS_DIA;
}

/** Segunda e sábado desta semana estão abertos? (semana sim, semana não, a partir de SEMANA_REF) */
export function semanaAberta(dataIso: string): boolean {
  const semanas = Math.round((segundaDaSemana(dataIso) - segundaDaSemana(SEMANA_REF)) / (7 * MS_DIA));
  return Math.abs(semanas) % 2 === 0;
}

/** Horários de INÍCIO possíveis em um dia ("08:00", "09:00"...). Vazio se não atende. */
export function horariosDoDia(dataIso: string): string[] {
  const dow = new Date(`${dataIso}T00:00:00Z`).getUTCDay();
  const regra = REGRAS[dow];
  if (!regra) return [];
  if (regra.alterna && !semanaAberta(dataIso)) return [];
  const out: string[] = [];
  for (const [ini, fim] of regra.janelas) {
    for (let m = minutos(ini); m + DURACAO_MIN <= minutos(fim); m += DURACAO_MIN) out.push(hhmm(m));
  }
  return out;
}

/** Um horário escolhido à mão está dentro do atendimento? (usado só para AVISAR, nunca para bloquear). */
export function dentroDoAtendimento(dataIso: string, hora: string): boolean {
  return horariosDoDia(dataIso).includes(hora);
}
