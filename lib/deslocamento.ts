// DESLOCAMENTO ENTRE CONSULTÓRIOS (Capoeiras ⇄ Centro).
// O Anderson leva cerca de 1h30 para sair de um consultório, arrumar a sala e chegar ao outro (e, indo para o Centro,
// ainda precisa reservar a sala). Por isso:
//   • sessões em consultórios DIFERENTES precisam de pelo menos GAP_TROCA_MIN minutos entre o fim de uma e o início da outra;
//   • no mesmo consultório, uma sessão pode vir logo depois da outra;
//   • o ideal é agrupar o dia em um só consultório (a lista de horários mostra qual é o "dia" de cada consultório).
// Funções puras, sem acesso a banco.
import { DURACAO_MIN } from "./horarios-atendimento";

export type LocalId = "capoeiras" | "centro";
export const NOME_LOCAL: Record<LocalId, string> = { capoeiras: "Capoeiras", centro: "Centro" };

/** Mínimo, em minutos, entre o FIM de uma sessão e o INÍCIO da próxima quando os consultórios são diferentes. */
export const GAP_TROCA_MIN = 90;

export interface Compromisso {
  inicio: number; // ms
  fim: number; // ms
  local: LocalId | null; // null = sessão antiga sem consultório informado (não restringe)
}

export function outroLocal(l: LocalId): LocalId {
  return l === "capoeiras" ? "centro" : "capoeiras";
}

/** A sessão que começa em `inicioMs`, no consultório `local`, respeita o deslocamento em relação às demais? */
export function conflitoDeslocamento(
  inicioMs: number,
  local: LocalId,
  compromissos: Compromisso[],
  duracaoMin = DURACAO_MIN,
): Compromisso | null {
  const fimMs = inicioMs + duracaoMin * 60000;
  const gap = GAP_TROCA_MIN * 60000;
  for (const c of compromissos) {
    if (!c.local || c.local === local) continue;
    if (inicioMs < c.fim + gap && fimMs + gap > c.inicio) return c;
  }
  return null;
}

/** Texto curto para avisar o Anderson quando um horário não deixa tempo de deslocamento. */
export function avisoDeslocamento(c: Compromisso, local: LocalId): string {
  const hora = new Date(c.inicio - 3 * 3600000);
  const hh = `${String(hora.getUTCHours()).padStart(2, "0")}:${String(hora.getUTCMinutes()).padStart(2, "0")}`;
  return `Atenção: há uma sessão em ${NOME_LOCAL[c.local as LocalId]} às ${hh}, e entre ${NOME_LOCAL[c.local as LocalId]} e ${NOME_LOCAL[local]} são necessários cerca de ${GAP_TROCA_MIN} minutos de deslocamento.`;
}

/** Consultórios que já têm sessão marcada no dia (AAAA-MM-DD, fuso de São Paulo). */
export function locaisDoDia(dataIso: string, compromissos: Compromisso[]): Set<LocalId> {
  const ini = new Date(`${dataIso}T00:00:00-03:00`).getTime();
  const fim = ini + 86400000;
  const s = new Set<LocalId>();
  for (const c of compromissos) if (c.local && c.inicio >= ini && c.inicio < fim) s.add(c.local);
  return s;
}
