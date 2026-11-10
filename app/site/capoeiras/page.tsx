import type { Metadata } from "next";
import { PaginaConsultorio } from "@/components/site/PaginaConsultorio";

export const metadata: Metadata = {
  title: "Fisioterapia em Capoeiras, Florianópolis",
  description:
    "Consultório de fisioterapia em Capoeiras, na Rua Joaquim Carneiro, 207, Florianópolis. Atendimento individual com hora marcada, de segunda a sexta.",
  alternates: { canonical: "/capoeiras" },
};

// Dinâmica como as páginas de serviço: no build (Docker) o banco não está disponível e a lista de tratamentos sairia vazia.
export const dynamic = "force-dynamic";

export default function Page() {
  return <PaginaConsultorio id="capoeiras" />;
}
