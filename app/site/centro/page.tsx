import type { Metadata } from "next";
import { PaginaConsultorio } from "@/components/site/PaginaConsultorio";

export const metadata: Metadata = {
  title: "Fisioterapia no Centro de Florianópolis",
  description:
    "Consultório de fisioterapia no Centro de Florianópolis, no Espaço Beira Mar, Sala 06, R. Altamiro Guimarães, 190. Atendimento individual com hora marcada.",
  alternates: { canonical: "/centro" },
};

// Dinâmica como as páginas de serviço: no build (Docker) o banco não está disponível e a lista de tratamentos sairia vazia.
export const dynamic = "force-dynamic";

export default function Page() {
  return <PaginaConsultorio id="centro" />;
}
