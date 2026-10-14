import type { Metadata } from "next";
import Link from "next/link";
import {
  CONSULTORIOS,
  CREFITO,
  HORARIO_TEXTO,
  FACEBOOK_URL,
  INSTAGRAM,
  INSTAGRAM_URL,
  MARCA,
  PROFISSIONAL,
  SITE_URL,
} from "@/lib/site";
import { CapturaOrigem } from "@/components/site/CapturaOrigem";
import { RedesSociais } from "@/components/site/RedesSociais";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fisioterapia em Florianópolis | Anderson Andrade Fisio",
    template: "%s | Anderson Andrade Fisio",
  },
  description:
    "Fisioterapia individual em Florianópolis, em Capoeiras e no Centro. Avaliação e tratamento na mesma sessão, com terapia manual, osteopatia e quiropraxia. Agende pelo WhatsApp.",
  // O layout do painel marca tudo como noindex; aqui o site precisa ser indexado.
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: MARCA,
    url: SITE_URL,
    title: "Fisioterapia em Florianópolis | Anderson Andrade Fisio",
    description:
      "Atendimento individual em Capoeiras e no Centro. Avaliação e tratamento na mesma sessão. Agende pelo WhatsApp.",
    images: [{ url: "/img/coluna.webp", width: 1536, height: 1024, alt: "Fisioterapia em Florianópolis" }],
  },
  alternates: { canonical: "/" },
};

function jsonLd() {
  const base = {
    "@context": "https://schema.org",
    "@type": "Physiotherapy",
    name: MARCA,
    url: SITE_URL,
    description:
      "Fisioterapia individual com terapia manual, osteopatia e quiropraxia, em Florianópolis.",
    sameAs: [INSTAGRAM_URL, ...(FACEBOOK_URL ? [FACEBOOK_URL] : [])],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "19:00",
      },
    ],
    employee: { "@type": "Person", name: PROFISSIONAL, jobTitle: "Fisioterapeuta" },
    location: [
      {
        "@type": "Place",
        name: CONSULTORIOS.capoeiras.nome,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Rua Joaquim Carneiro, 207",
          addressLocality: "Florianópolis",
          addressRegion: "SC",
          postalCode: CONSULTORIOS.capoeiras.cep,
          addressCountry: "BR",
        },
      },
      {
        "@type": "Place",
        name: CONSULTORIOS.centro.nome,
        address: {
          "@type": "PostalAddress",
          streetAddress: "R. Altamiro Guimarães, 190, Sala 06",
          addressLocality: "Florianópolis",
          addressRegion: "SC",
          addressCountry: "BR",
        },
      },
    ],
  };
  return JSON.stringify(base);
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen bg-[#FAF8F5] font-sans text-[#1c2b22]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <CapturaOrigem />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#2f9e5e] via-[#3bb26c] to-[#e07e2b]" />
      <header className="border-b border-[#e8e2d8] bg-[#FAF8F5]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/" className="font-display text-[17px] font-semibold tracking-tight text-[#16351f] sm:text-[19px]">
            Anderson Andrade <span className="text-[#2f9e5e]">Fisio</span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-[14px] sm:gap-3">
            <Link href="/capoeiras" className="hidden rounded-lg px-2.5 py-2 text-[#4b5b51] hover:text-[#16351f] sm:block">
              Capoeiras
            </Link>
            <Link href="/centro" className="hidden rounded-lg px-2.5 py-2 text-[#4b5b51] hover:text-[#16351f] sm:block">
              Centro
            </Link>
            <Link href="/duvidas" className="hidden rounded-lg px-2.5 py-2 text-[#4b5b51] hover:text-[#16351f] sm:block">
              Dúvidas
            </Link>
            <Link
              href="/agendar"
              className="rounded-xl bg-[#2f9e5e] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#278a50]"
            >
              Agendar
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="mt-16 border-t border-[#e8e2d8] bg-[#f3efe8]">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-[14px] text-[#4b5b51] sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-display text-[16px] font-semibold text-[#16351f]">{MARCA}</p>
            <p className="mt-2">{PROFISSIONAL}</p>
            <p>Fisioterapeuta · {CREFITO}</p>
            <p className="mt-2">{HORARIO_TEXTO}</p>
            <p className="mt-4 font-semibold text-[#16351f]">Redes sociais</p>
            <RedesSociais comTexto className="mt-2" />
          </div>
          <div>
            <p className="font-semibold text-[#16351f]">Consultórios</p>
            <p className="mt-2">
              <Link href="/capoeiras" className="underline-offset-2 hover:underline">
                Capoeiras
              </Link>
              <br />
              Rua Joaquim Carneiro, 207
            </p>
            <p className="mt-2">
              <Link href="/centro" className="underline-offset-2 hover:underline">
                Centro
              </Link>
              <br />
              R. Altamiro Guimarães, 190, Sala 06
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#16351f]">Mais</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/agendar" className="underline-offset-2 hover:underline">
                  Agendar avaliação
                </Link>
              </li>
              <li>
                <Link href="/duvidas" className="underline-offset-2 hover:underline">
                  Dúvidas frequentes
                </Link>
              </li>
              <li>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  Instagram @{INSTAGRAM}
                </a>
              </li>
              <li>
                <Link href="/privacidade" className="underline-offset-2 hover:underline">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-8 text-[12.5px] leading-relaxed text-[#6b7a71] sm:px-6">
          As informações deste site são educativas e não substituem a avaliação de um profissional. Em caso de
          emergência (por exemplo, perda de força súbita, dor intensa após queda, perda de controle da urina ou
          das fezes, febre com dor, falta de ar ou dor no peito), procure um pronto-socorro ou ligue 192 (SAMU).
        </p>
      </footer>
    </div>
  );
}
