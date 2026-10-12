import type { Metadata } from "next";
import { PaginaConsultorio } from "@/components/site/PaginaConsultorio";

export const metadata: Metadata = {
  title: "Fisioterapia em Capoeiras, Florianópolis",
  description:
    "Consultório de fisioterapia em Capoeiras, na Rua Joaquim Carneiro, 207, Florianópolis. Atendimento individual com hora marcada, de segunda a sexta.",
  alternates: { canonical: "/capoeiras" },
};

export default function Page() {
  return <PaginaConsultorio id="capoeiras" />;
}
