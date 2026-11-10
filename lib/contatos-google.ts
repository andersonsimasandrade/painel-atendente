// CONTATOS PARA O GOOGLE: lista os pacientes (nome + telefone) que o script da conta Google do consultório copia para o
// Google Contatos, para o WhatsApp do celular mostrar o NOME em vez do número. Server-only.
import { getClient } from "./db";
import { ehNumeroInterno } from "./numeros-internos";
import { variantesTelefone } from "./telefone";

export interface ContatoGoogle {
  id: string; // chave estável do paciente: DDD + últimos 8 dígitos (igual com ou sem o 9)
  nome: string;
  telefone: string; // formato internacional, com o 9: +5548991897280
}

const SEM_NOME = /^(desconhecido|sem nome|lead sem nome|paciente|cliente|contato)$/i;

function nomeValido(n: string | null | undefined): string | null {
  const s = String(n ?? "").replace(/\s+/g, " ").trim();
  if (s.length < 2 || !/[A-Za-zÀ-ÿ]/.test(s) || SEM_NOME.test(s)) return null;
  if (/^[\d\s+()-]+$/.test(s)) return null; // só número
  return s.slice(0, 120);
}

/** Celular brasileiro no formato internacional com o 9 (o WhatsApp entrega alguns números sem ele). */
function e164(tel: string): string | null {
  const v = variantesTelefone(tel);
  const com9 = v.find((x) => x.startsWith("55") && x.length === 13) ?? v[0];
  const d = String(com9 ?? "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  return `+${d}`;
}

function chave(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `${d.slice(2, 4)}${d.slice(-8)}`;
  return d.length >= 8 ? d : null;
}

export async function listarContatosParaGoogle(): Promise<ContatoGoogle[]> {
  const r = await getClient().from("ff_contatos").select("telefone, nome").not("nome", "is", null).limit(10000);
  const vistos = new Set<string>();
  const saida: ContatoGoogle[] = [];
  for (const c of (r.data ?? []) as { telefone: string; nome: string | null }[]) {
    const nome = nomeValido(c.nome);
    const k = chave(c.telefone);
    const tel = e164(c.telefone);
    // só pacientes com celular brasileiro: números de fora (códigos de verificação, serviços) não são pacientes
    if (!nome || !k || !tel || !tel.startsWith("+55") || ehNumeroInterno(c.telefone) || vistos.has(k)) continue;
    vistos.add(k);
    saida.push({ id: k, nome, telefone: tel });
  }
  return saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
