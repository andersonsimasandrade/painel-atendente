import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataLonga, fotoDoAutor, minutosDeLeitura, postPorSlug, relacionados } from "@/lib/blog";
import { articleLd, breadcrumbLd, faqLd, imagemAbsoluta, ldParaScript, urlDoPost } from "@/lib/blog-seo";
import { renderMarkdown } from "@/lib/markdown";
import { CREFITO, PROFISSIONAL, SITE_URL } from "@/lib/site";
import { BlogCartao, ROTULO_LOCAL } from "@/components/site/BlogLista";

// Dados em cache de 1 hora (lib/blog.ts) + webhook /api/blog/revalidar para atualizar na hora.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await postPorSlug(params.slug).catch(() => null);
  if (!p) return { title: "Artigo não encontrado", robots: { index: false, follow: false } };
  const url = urlDoPost(p.slug);
  const imagem = imagemAbsoluta(p);
  return {
    title: p.titulo,
    description: p.descricao,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "pt_BR",
      url,
      title: p.titulo,
      description: p.descricao,
      publishedTime: p.publicado_em,
      modifiedTime: p.atualizado_em,
      authors: [PROFISSIONAL],
      tags: p.tags,
      images: [{ url: imagem, alt: p.imagem_alt ?? p.titulo }],
    },
    twitter: { card: "summary_large_image", title: p.titulo, description: p.descricao, images: [imagem] },
  };
}

export default async function Artigo({ params }: { params: { slug: string } }) {
  const p = await postPorSlug(params.slug).catch(() => null);
  if (!p) notFound();
  const outros = await relacionados(p.slug, p.tags, p.local).catch(() => []);
  const foto = fotoDoAutor();
  const mostrarAtualizacao = new Date(p.atualizado_em).getTime() - new Date(p.publicado_em).getTime() > 24 * 3600 * 1000;
  const faq = faqLd(p);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(articleLd(p, foto)) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(faq) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(breadcrumbLd(p)) }} />

      <nav aria-label="Você está em" className="mb-5 text-[13px] text-[#5E7371]">
        <Link href="/" className="hover:underline">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>
      </nav>

      <header>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#0F7F70]">
          {ROTULO_LOCAL[p.local]}
          {p.tags.length ? ` · ${p.tags.slice(0, 3).join(" · ")}` : ""}
        </p>
        <h1 className="mt-2 font-destaque text-[28px] font-bold leading-tight text-[#354746] sm:text-[38px]">{p.titulo}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-[#4A5F5D]">{p.descricao}</p>

        <div className="mt-6 flex items-center gap-3.5 border-y border-[#DCE8E5] py-4">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt={PROFISSIONAL} width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1EB49F] to-[#0F7F70] font-destaque text-[18px] font-bold text-white"
            >
              AA
            </span>
          )}
          <div className="min-w-0 text-[14px] leading-snug text-[#4A5F5D]">
            <p className="font-semibold text-[#354746]">
              {PROFISSIONAL} · Fisioterapeuta · {CREFITO}
            </p>
            <p className="mt-0.5">
              Publicado em <time dateTime={p.publicado_em}>{dataLonga(p.publicado_em)}</time>
              {mostrarAtualizacao && (
                <>
                  {" "}
                  · Atualizado em <time dateTime={p.atualizado_em}>{dataLonga(p.atualizado_em)}</time>
                </>
              )}{" "}
              · {minutosDeLeitura(p.corpo_md)} min de leitura
            </p>
          </div>
        </div>
      </header>

      {p.imagem_url && (
        <figure className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imagem_url} alt={p.imagem_alt ?? p.titulo} className="h-auto w-full rounded-2xl object-cover" />
        </figure>
      )}

      <p className="my-5 rounded-xl border border-[#BFE8E1] bg-[#EAF8F6] px-4 py-3 text-[13.5px] leading-relaxed text-[#3F5452]">
        <strong>Conteúdo informativo, não substitui avaliação.</strong> Cada pessoa precisa ser avaliada individualmente por um
        profissional.
      </p>

      <div className="text-[16.5px] text-[#243635]">{renderMarkdown(p.corpo_md)}</div>

      {p.post_instagram && (
        <p className="my-8 rounded-2xl border border-[#DCE8E5] bg-white p-4 text-[15px]">
          Este tema também está no nosso Instagram:{" "}
          <a href={p.post_instagram} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0F7F70] underline underline-offset-2">
            veja o post
          </a>
          .
        </p>
      )}

      {p.faq.length > 0 && (
        <section className="mt-10" aria-labelledby="faq">
          <h2 id="faq" className="font-destaque text-[22px] font-bold text-[#354746] sm:text-[26px]">
            Perguntas frequentes
          </h2>
          <div className="mt-4 divide-y divide-[#DCE8E5] rounded-2xl border border-[#DCE8E5] bg-white">
            {p.faq.map((f) => (
              <details key={f.pergunta} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold text-[#354746] marker:hidden">
                  <span className="mr-2 text-[#0F7F70] group-open:hidden">+</span>
                  <span className="mr-2 hidden text-[#0F7F70] group-open:inline">−</span>
                  {f.pergunta}
                </summary>
                <p className="mt-2 pl-5 leading-relaxed text-[#4A5F5D]">{f.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {p.fontes.length > 0 && (
        <section className="mt-10" aria-labelledby="fontes">
          <h2 id="fontes" className="font-destaque text-[20px] font-bold text-[#354746]">
            Fontes
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[14.5px] marker:text-[#0F7F70]">
            {p.fontes.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[#0F7F70] underline underline-offset-2 hover:text-[#0B6B5E]">
                  {f.titulo}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-12 rounded-2xl bg-gradient-to-br from-[#EAF8F6] to-[#DCE8E5] p-6 text-center sm:p-8">
        <p className="font-destaque text-[21px] font-bold text-[#354746]">Quer que o Anderson avalie o seu caso?</p>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-[#4A5F5D]">
          A sessão é individual, com avaliação e técnicas na mesma hora. Escolha os dias e horários e continue pelo WhatsApp.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/agendar"
            data-local="blog-artigo"
            className="rounded-xl bg-[#0F7F70] px-6 py-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#0B6B5E]"
          >
            Agendar
          </Link>
          {p.local !== "ambos" && (
            <Link href={`/${p.local}`} className="rounded-xl border border-[#0F7F70] px-5 py-3 text-[15px] font-bold text-[#0F7F70] hover:bg-white">
              Conhecer o consultório de {ROTULO_LOCAL[p.local]}
            </Link>
          )}
        </div>
      </section>

      {outros.length > 0 && (
        <section className="mt-14" aria-labelledby="relacionados">
          <h2 id="relacionados" className="font-destaque text-[22px] font-bold text-[#354746]">
            Continue lendo
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {outros.map((o) => (
              <BlogCartao key={o.slug} p={o} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-[13px] text-[#5E7371]">
        <Link href="/blog" className="font-semibold hover:underline">
          ← Todos os artigos
        </Link>{" "}
        · <a href={SITE_URL} className="hover:underline">andersonandradefisio.com.br</a>
      </p>
    </article>
  );
}
