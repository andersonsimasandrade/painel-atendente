import type { Metadata } from "next";
import { listarPosts } from "@/lib/blog";
import { BlogLista } from "@/components/site/BlogLista";

// Os dados vêm de um cache de 1 hora (lib/blog.ts) e são renovados na hora pelo webhook /api/blog/revalidar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog de fisioterapia e terapia manual",
  description:
    "Artigos informativos sobre coluna, cervical, lombar e terapia manual, escritos pelo fisioterapeuta Anderson Andrade, em Florianópolis.",
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", url: "/blog", title: "Blog | Anderson Andrade Fisioterapia", description: "Conteúdo informativo de fisioterapia e terapia manual." },
};

export default async function BlogPagina() {
  let dados: Awaited<ReturnType<typeof listarPosts>> | null = null;
  try {
    dados = await listarPosts(1);
  } catch (e) {
    console.error("[blog] lista:", e instanceof Error ? e.message : e);
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-destaque text-[30px] font-bold leading-tight text-[#354746] sm:text-[38px]">Blog</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[#4A5F5D]">
          Conteúdo informativo sobre coluna, cervical, lombar e terapia manual, para complementar o que compartilhamos no Instagram.
          Não substitui a avaliação de um profissional.
        </p>
      </header>
      {dados ? (
        <BlogLista posts={dados.posts} pagina={1} paginas={dados.paginas} />
      ) : (
        <p className="rounded-2xl border border-[#DCE8E5] bg-white p-8 text-center text-[#4A5F5D]">Não foi possível carregar os artigos agora. Tente de novo em instantes.</p>
      )}
    </div>
  );
}
