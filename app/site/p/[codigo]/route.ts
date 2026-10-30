import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getClient } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimited } from "@/lib/ratelimit";
import { parceiroPorCodigo } from "@/lib/indicacoes";
import { SITE_URL, whatsappNumero } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /p/<codigo-do-parceiro> — link que o parceiro passa ao paciente.
// Abre o WhatsApp do consultório já com "fui indicado(a) por <parceiro>" e um código curto no fim; o robô liga a
// conversa a esse registro (como no pedido do site) e a origem passa a ser "indicação" daquele parceiro.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const codigoCurto = () => Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

export async function GET(req: Request, { params }: { params: { codigo: string } }) {
  const parceiro = await parceiroPorCodigo(decodeURIComponent(params.codigo).slice(0, 60));
  if (!parceiro || !parceiro.ativo) return NextResponse.redirect(`${SITE_URL}/`, 302);
  if (await rateLimited(`site-p:${clientIp(req)}`, 30, 600)) return NextResponse.redirect(`${SITE_URL}/`, 302);

  const sb = getClient();
  let codigo = "";
  for (let t = 0; t < 5 && !codigo; t++) {
    const c = codigoCurto();
    const { error } = await sb.from("site_pedidos").insert({
      codigo: c,
      consultorio: "qualquer",
      dias: [],
      periodos: [],
      canal: "outro",
      utm_source: "indicacao",
      utm_medium: "parceiro",
      utm_campaign: parceiro.codigo,
    });
    if (!error) codigo = c;
    else if (error.code !== "23505") break;
  }
  const texto = `Olá! Fui indicado(a) por ${parceiro.nome} e quero saber mais sobre fisioterapia.${codigo ? ` (código ${codigo})` : ""}`;
  return NextResponse.redirect(`https://wa.me/${whatsappNumero()}?text=${encodeURIComponent(texto)}`, 302);
}
