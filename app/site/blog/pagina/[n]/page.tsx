import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { listarPosts } from "@/lib/blog";
import { BlogLista } from "@/components/site/BlogLista";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { n: string } }): Promise<Metadata> {
  return {
    title: `Blog, página ${params.n}`,
    description: "Artigos informativos sobre coluna, cervical, lombar e terapia manual.",
    alternates: { canonical: `/blog/pagina/${params.n}` },
  };
}

export default async function BlogPaginaN({ params }: { params: { n: string } }) {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1) notFound();
  if (n === 1) redirect("/blog");
  const dados = await listarPosts(n).catch(() => null);
  if (!dados || n > dados.paginas) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 font-destaque text-[30px] font-bold leading-tight text-[#354746] sm:text-[38px]">Blog</h1>
      <BlogLista posts={dados.posts} pagina={n} paginas={dados.paginas} />
    </div>
  );
}
