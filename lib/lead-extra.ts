// Campos extras da ficha do lead (e-mail e endereço) e sinal de "voltou a falar". Server-only.
import { getClient } from "./db";
import { variantesTelefone } from "./telefone";
import type { EnderecoLead } from "@/components/lead/EditarEndereco";

export interface ExtraLead extends EnderecoLead {
  email: string | null;
  origem_canal: string | null;
  origem_manual: boolean;
  tem_gclid: boolean;
  tem_fbclid: boolean;
}

export async function getExtraLead(telefone: string): Promise<ExtraLead> {
  const vazio: ExtraLead = { origem_canal: null, origem_manual: false, tem_gclid: false, tem_fbclid: false, email: null, cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null };
  try {
    const r = await getClient()
      .from("ff_contatos")
      .select("email, cep, logradouro, numero, complemento, bairro, cidade, uf, origem_canal, origem_manual, gclid, fbclid")
      .in("telefone", variantesTelefone(telefone))
      .limit(1);
    const c = (r.data?.[0] ?? null) as (Record<string, string | boolean | null>) | null;
    if (!c) return vazio;
    const { gclid, fbclid, ...resto } = c;
    return { ...vazio, ...(resto as Partial<ExtraLead>), tem_gclid: !!gclid, tem_fbclid: !!fbclid };
  } catch {
    return vazio;
  }
}

/** A pessoa escreveu depois de a última negociação ser encerrada (perdida)? */
export async function voltouAFalar(telefone: string, encerradaEm: string | null): Promise<boolean> {
  if (!encerradaEm) return false;
  try {
    const r = await getClient()
      .from("ff_mensagens")
      .select("criada_em")
      .in("telefone", variantesTelefone(telefone))
      .eq("direcao", "entrada")
      .gt("criada_em", encerradaEm)
      .limit(1);
    return !!r.data?.length;
  } catch {
    return false;
  }
}
