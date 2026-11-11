import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessao } from "@/lib/session";
import { podeVerLead } from "@/lib/escopo";
import { assinaturaProfissional, devolutivaDoPainel } from "@/lib/devolutivas";
import { whatsappNumero } from "@/lib/site";
import { DocumentoDevolutiva } from "@/components/site/DocumentoDevolutiva";
import { BarraPreviaDevolutiva } from "@/components/lead/BarraPreviaDevolutiva";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Devolutiva (prévia)", robots: { index: false, follow: false } };

// Prévia da devolutiva DENTRO do painel (login do painel, sem senha de nascimento): quem confecciona precisa ver, baixar o PDF
// e mandar no WhatsApp sem depender do link.
export default async function PreviaDevolutiva({ params }: { params: { id: string } }) {
  const sess = await getSessao();
  if (!sess) redirect("/login");
  const r = await devolutivaDoPainel(params.id);
  if (!r || !(await podeVerLead(sess, r.telefone))) notFound();
  const assinatura = await assinaturaProfissional();
  return (
    <div style={{ background: "#fff", minHeight: "100vh", color: "#354746" }}>
      <BarraPreviaDevolutiva telefone={r.telefone} id={params.id} />
      <DocumentoDevolutiva d={r.doc} assinatura={assinatura} wa={`https://wa.me/${whatsappNumero()}`} painel />
    </div>
  );
}
