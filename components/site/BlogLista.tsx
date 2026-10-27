import Link from "next/link";
import { dataLonga, type BlogResumo } from "@/lib/blog";

export const ROTULO_LOCAL: Record<string, string> = {
  capoeiras: "Capoeiras",
  centro: "Centro",
  ambos: "Capoeiras e Centro",
};

export function BlogCartao({ p }: { p: BlogResumo }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#DCE8E5] bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/blog/${p.slug}`} className="block" aria-label={p.titulo}>
        {p.imagem_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagem_url} alt={p.imagem_alt ?? ""} loading="lazy" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#EAF8F6] to-[#DCE8E5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/simbolo.png" alt="" width={771} height={668} className="h-16 w-auto opacity-70" />
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0F7F70]">
          {ROTULO_LOCAL[p.local] ?? "Blog"} · {dataLonga(p.publicado_em)}
        </p>
        <h2 className="mt-2 font-destaque text-[19px] font-bold leading-snug text-[#354746]">
          <Link href={`/blog/${p.slug}`} className="hover:text-[#0F7F70]">
            {p.titulo}
          </Link>
        </h2>
        <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-[#4A5F5D]">{p.descricao}</p>
        <Link href={`/blog/${p.slug}`} className="mt-4 text-[14px] font-bold text-[#0F7F70] hover:text-[#0B6B5E]">
          Ler o artigo →
        </Link>
      </div>
    </article>
  );
}

export function BlogLista({ posts, pagina, paginas }: { posts: BlogResumo[]; pagina: number; paginas: number }) {
  const href = (n: number) => (n <= 1 ? "/blog" : `/blog/pagina/${n}`);
  return (
    <>
      {posts.length === 0 ? (
        <p className="rounded-2xl border border-[#DCE8E5] bg-white p-8 text-center text-[#4A5F5D]">
          Os primeiros artigos chegam em breve. Enquanto isso, acompanhe o conteúdo no Instagram.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <BlogCartao key={p.slug} p={p} />
          ))}
        </div>
      )}
      {paginas > 1 && (
        <nav aria-label="Páginas do blog" className="mt-10 flex items-center justify-center gap-2 text-[14px]">
          {pagina > 1 && (
            <Link href={href(pagina - 1)} rel="prev" className="rounded-xl border border-[#BFD3CF] px-4 py-2 font-semibold text-[#354746] hover:bg-[#EAF1EF]">
              ← Mais novos
            </Link>
          )}
          <span className="px-3 text-[#4A5F5D]">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={href(pagina + 1)} rel="next" className="rounded-xl border border-[#BFD3CF] px-4 py-2 font-semibold text-[#354746] hover:bg-[#EAF1EF]">
              Mais antigos →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
