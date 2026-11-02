import { destinatariosAlerta } from "@/lib/config";

// Números que NÃO são pacientes: o próprio Anderson (dono/administrador) e números usados em testes.
// Comparação pelos 8 últimos dígitos (vale com e sem o 9 da frente). Esses números não geram tarefas de relacionamento.
const DONO_PADRAO = "84223242"; // +55 48 98422-3242
const TESTES = ["91326336"]; // número de teste do robô

export function ehNumeroInterno(telefone: string | null | undefined): boolean {
  const fim = String(telefone ?? "").replace(/\D/g, "").slice(-8);
  if (fim.length < 8) return false;
  const donos = [DONO_PADRAO, ...destinatariosAlerta().map((d) => (d.whatsapp ?? "").replace(/\D/g, "").slice(-8))].filter(Boolean);
  return donos.includes(fim) || TESTES.includes(fim);
}
