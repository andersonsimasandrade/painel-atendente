import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarPaginas, paginaPorSlug, videoIncorporado, type PaginaServico } from "@/lib/paginas";
import { ldParaScript } from "@/lib/blog-seo";
import { renderMarkdown } from "@/lib/markdown";
import { CONSULTORIOS, CREFITO, HORARIO_TEXTO, MARCA, PROFISSIONAL, SITE_URL } from "@/lib/site";

// Página de serviço (quiropraxia, osteopatia, joelho...). Dados em cache de 1 hora (lib/paginas.ts)
// + webhook /api/blog/revalidar para atualizar na hora. As rotas fixas do site (capoeiras, centro, blog...) têm
// prioridade sobre esta rota dinâmica, e o banco recusa esses nomes como slug.
export const dynamic = "force-dynamic";

const urlDaPagina = (slug: string) => `${SITE_URL}/${slug}`;
const imagemAbsoluta = (u: string | null) => (!u ? `${SITE_URL}/img/coluna.webp` : u.startsWith("/") ? `${SITE_URL}${u}` : u);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await paginaPorSlug(params.slug).catch(() => null);
  if (!p) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  const url = urlDaPagina(p.slug);
  const titulo = p.titulo_seo ?? p.titulo;
  const imagem = imagemAbsoluta(p.imagem_url);
  return {
    // absolute: o título já traz o nome da marca quando precisa (o modelo do layout acrescentaria de novo).
    title: { absolute: titulo },
    description: p.descricao,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "pt_BR", url, title: titulo, description: p.descricao, images: [{ url: imagem, alt: p.imagem_alt ?? p.titulo }] },
    twitter: { card: "summary_large_image", title: titulo, description: p.descricao, images: [imagem] },
  };
}

function paginaLd(p: PaginaServico) {
  const url = urlDaPagina(p.slug);
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": url,
    url,
    name: p.titulo,
    description: p.descricao,
    inLanguage: "pt-BR",
    dateModified: p.atualizado_em,
    image: imagemAbsoluta(p.imagem_url),
    reviewedBy: {
      "@type": "Person",
      name: PROFISSIONAL,
      jobTitle: "Fisioterapeuta",
      identifier: { "@type": "PropertyValue", propertyID: "CREFITO", value: CREFITO },
    },
    about: { "@type": "MedicalTherapy", name: p.rotulo },
    provider: { "@type": "Physiotherapy", name: MARCA, url: SITE_URL },
    ...(p.fontes.length ? { citation: p.fontes.map((f) => ({ "@type": "CreativeWork", name: f.titulo, url: f.url })) } : {}),
  };
}

function faqLd(p: PaginaServico) {
  if (!p.faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })),
  };
}

function breadcrumbLd(p: PaginaServico) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tratamentos", item: `${SITE_URL}/tratamentos` },
      { "@type": "ListItem", position: 3, name: p.rotulo, item: urlDaPagina(p.slug) },
    ],
  };
}

function videoLd(p: PaginaServico) {
  const id = p.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)?.[1];
  if (!id) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: p.titulo,
    description: p.descricao,
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    uploadDate: p.publicado_em,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  };
}

function BotaoAgendar({ onde }: { onde: string }) {
  return (
    <Link
      href="/agendar"
      data-local={`pagina-${onde}`}
      className="inline-block rounded-xl bg-[#0F7F70] px-6 py-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#0B6B5E]"
    >
      Agendar
    </Link>
  );
}

export default async function PaginaDeServico({ params }: { params: { slug: string } }) {
  const p = await paginaPorSlug(params.slug).catch(() => null);
  if (!p) notFound();
  const outras = (await listarPaginas().catch(() => [])).filter((x) => x.slug !== p.slug);
  const video = videoIncorporado(p.video_url);
  const faq = faqLd(p);
  const vld = videoLd(p);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(paginaLd(p)) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(faq) }} />}
      {vld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(vld) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldParaScript(breadcrumbLd(p)) }} />

      <nav aria-label="Você está em" className="mb-5 text-[13px] text-[#5E7371]">
        <Link href="/" className="hover:underline">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/tratamentos" className="hover:underline">
          Tratamentos
        </Link>
      </nav>

      <header>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#0F7F70]">Capoeiras e Centro · Florianópolis</p>
        <h1 className="mt-2 font-destaque text-[28px] font-bold leading-tight text-[#354746] sm:text-[38px]">{p.titulo}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-[#4A5F5D]">{p.descricao}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <BotaoAgendar onde="topo" />
          <span className="text-[13.5px] text-[#5E7371]">
            {PROFISSIONAL} · Fisioterapeuta · {CREFITO}
          </span>
        </div>
      </header>

      {video ? (
        <div className="my-7 aspect-video overflow-hidden rounded-2xl bg-[#DCE8E5]">
          <iframe
            src={video}
            title={p.titulo}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        p.imagem_url && (
          <figure className="my-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imagem_url} alt={p.imagem_alt ?? p.titulo} className="h-auto w-full rounded-2xl object-cover" />
          </figure>
        )
      )}

      <div className="text-[16.5px] text-[#243635]">{renderMarkdown(p.corpo_md)}</div>

      <section className="mt-10" aria-labelledby="onde">
        <h2 id="onde" className="font-destaque text-[22px] font-bold text-[#354746] sm:text-[26px]">
          Onde é o atendimento
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(["capoeiras", "centro"] as const).map((id) => {
            const c = CONSULTORIOS[id];
            return (
              <div key={id} className="rounded-2xl border border-[#DCE8E5] bg-white p-5">
                <p className="font-destaque text-[17px] font-bold text-[#354746]">{c.nome}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4A5F5D]">{c.linhaEndereco}</p>
                <Link href={`/${id}`} className="mt-3 inline-block text-[14px] font-bold text-[#0F7F70] underline underline-offset-2">
                  Como chegar
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[14px] text-[#5E7371]">{HORARIO_TEXTO}. Com hora marcada.</p>
      </section>

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
        <div className="mt-5">
          <BotaoAgendar onde="fim" />
        </div>
      </section>

      {outras.length > 0 && (
        <section className="mt-12" aria-labelledby="outros">
          <h2 id="outros" className="font-destaque text-[20px] font-bold text-[#354746]">
            Outros tratamentos
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {outras.map((o) => (
              <li key={o.slug}>
                <Link href={`/${o.slug}`} className="inline-block rounded-full border border-[#BFE8E1] bg-white px-4 py-2 text-[14px] font-semibold text-[#0F7F70] hover:bg-[#EAF8F6]">
                  {o.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-[12.5px] leading-relaxed text-[#5E7371]">
        As informações desta página são educativas e não substituem a avaliação de um profissional. Nenhuma técnica é indicada sem
        avaliação, e não há garantia de resultado.
      </p>
    </article>
  );
}
