// Dados estruturados (JSON-LD) do blog: Article, FAQPage e BreadcrumbList. Funções puras.
import { CREFITO, MARCA, PROFISSIONAL, SITE_URL } from "./site";
import type { BlogPost } from "./blog";

export const urlDoPost = (slug: string) => `${SITE_URL}/blog/${slug}`;

/** URL absoluta da imagem do artigo (ou a imagem padrão do site, que já é usada no compartilhamento). */
export function imagemAbsoluta(p: Pick<BlogPost, "imagem_url">): string {
  const u = p.imagem_url;
  if (!u) return `${SITE_URL}/img/coluna.webp`;
  return u.startsWith("/") ? `${SITE_URL}${u}` : u;
}

export function articleLd(p: BlogPost, fotoAutor: string | null) {
  const url = urlDoPost(p.slug);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: p.titulo.slice(0, 110),
    description: p.descricao,
    image: [imagemAbsoluta(p)],
    datePublished: p.publicado_em,
    dateModified: p.atualizado_em,
    inLanguage: "pt-BR",
    ...(p.tags.length ? { keywords: p.tags.join(", ") } : {}),
    author: {
      "@type": "Person",
      name: PROFISSIONAL,
      jobTitle: "Fisioterapeuta",
      url: SITE_URL,
      ...(fotoAutor ? { image: fotoAutor.startsWith("/") ? `${SITE_URL}${fotoAutor}` : fotoAutor } : {}),
      identifier: { "@type": "PropertyValue", propertyID: "CREFITO", value: CREFITO },
      worksFor: { "@type": "Physiotherapy", name: MARCA, url: SITE_URL },
    },
    publisher: {
      "@type": "Organization",
      name: MARCA,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/img/simbolo.png` },
    },
    ...(p.fontes.length ? { citation: p.fontes.map((f) => ({ "@type": "CreativeWork", name: f.titulo, url: f.url })) } : {}),
  };
}

export function faqLd(p: BlogPost) {
  if (!p.faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faq.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  };
}

export function breadcrumbLd(p: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: p.titulo, item: urlDoPost(p.slug) },
    ],
  };
}

/** Serializa para <script type="application/ld+json"> sem permitir fechar a tag (</script>) dentro do texto. */
export const ldParaScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
