import type { Metadata } from "next";
import Link from "next/link";
import { listarPaginas } from "@/lib/paginas";
import { SITE_URL } from "@/lib/site";

// Índice das páginas de serviço publicadas (lib/paginas.ts), na ordem do campo "ordem".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tratamentos de fisioterapia em Florianópolis",
  description: "Quiropraxia, osteopatia, terapia manual e fisioterapia para coluna, braços e pernas, em Capoeiras e no Centro de Florianópolis.",
  alternates: { canonical: `${SITE_URL}/tratamentos` },
};

export default async function Tratamentos() {
  const paginas = await listarPaginas().catch(() => []);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-destaque text-[28px] font-bold leading-tight text-[#354746] sm:text-[38px]">Tratamentos</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-[#4A5F5D]">
        A coluna é o que mais se procura, mas o atendimento vale para todas as articulações. Cada plano começa pela avaliação.
      </p>
      {paginas.length ? (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {paginas.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`} className="block h-full rounded-2xl border border-[#DCE8E5] bg-white p-5 transition hover:border-[#1EB49F]">
                <p className="font-destaque text-[18px] font-bold text-[#354746]">{p.rotulo}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4A5F5D]">{p.descricao}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-7 text-[15px] text-[#4A5F5D]">
          As páginas dos tratamentos estão sendo preparadas. Enquanto isso, veja as <Link href="/duvidas" className="font-semibold text-[#0F7F70] underline">dúvidas frequentes</Link>.
        </p>
      )}
    </div>
  );
}
