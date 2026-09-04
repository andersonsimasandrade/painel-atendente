import { SlotDia, Vendedor } from "./types";

// Brasil sem horário de verão desde 2019 → offset fixo -03:00.
const OFFSET = "-03:00";
const DIAS_BR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const SEMANA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const p2 = (n: number) => String(n).padStart(2, "0");

// "Agora" em campos do calendário SP: com offset fixo, subtrai 3h e lê os
// campos UTC — dão o horário local de São Paulo.
function camposSP(agora: Date) {
  const d = new Date(agora.getTime() - 3 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), dia: d.getUTCDate() };
}

/**
 * Gera os dias com horários disponíveis. Lógica PURA: recebe `agora` e os
 * instantes já ocupados. Remove horários passados (hoje) e ocupados.
 */
export function gerarSlotsDias(
  disponibilidade: Vendedor["disponibilidade"],
  ocupados: Set<string>, // ISOs UTC (data_hora) já reservados
  opts: { agora?: Date; horizonteDias?: number } = {},
): SlotDia[] {
  const agora = opts.agora ?? new Date();
  const horizonte = opts.horizonteDias ?? 14;
  const dias: SlotDia[] = [];
  const hoje = camposSP(agora);
  const base = Date.UTC(hoje.y, hoje.m, hoje.dia); // meia-noite SP de hoje, lida como UTC

  for (let i = 0; i < horizonte; i++) {
    const d = new Date(base + i * 86400000);
    const dow = d.getUTCDay(); // 0=dom..6=sáb (calendário SP)
    if (!disponibilidade.dias.includes(dow)) continue;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const dataIso = `${y}-${p2(m)}-${p2(dd)}`;

    const slots: SlotDia["slots"] = [];
    for (const hhmm of disponibilidade.horarios) {
      const [HH, MM] = hhmm.split(":");
      const iso = new Date(`${dataIso}T${HH}:${MM}:00${OFFSET}`).toISOString();
      if (new Date(iso).getTime() <= agora.getTime()) continue; // já passou
      if (ocupados.has(iso)) continue; // ocupado
      slots.push({ iso, hora: hhmm });
    }
    if (slots.length) {
      dias.push({ dataIso, diaSemana: DIAS_BR[dow], diaMes: `${p2(dd)}/${p2(m)}`, slots });
    }
  }
  return dias;
}

// Formata um ISO (data_hora) como "terça, 04/08, às 14:00" (BR, fuso SP).
export function formatarBR(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return `${SEMANA_LONGO[d.getUTCDay()]}, ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}, às ${p2(
    d.getUTCHours(),
  )}:${p2(d.getUTCMinutes())}`;
}
