import type { Metadata } from "next";
import Link from "next/link";
import { Comfortaa, Nunito } from "next/font/google";
import {
  CONSULTORIOS,
  CREFITO,
  HORARIO_TEXTO,
  FACEBOOK_URL,
  INSTAGRAM_URL,
  MARCA,
  PROFISSIONAL,
  SITE_URL,
  SLOGAN,
} from "@/lib/site";
import { CapturaOrigem } from "@/components/site/CapturaOrigem";
import { RedesSociais } from "@/components/site/RedesSociais";

// Tipografia do manual da marca: Nunito (títulos e texto) e Comfortaa Bold (destaques).
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-nunito", display: "swap" });
const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["700"], variable: "--font-comfortaa", display: "swap" });

const TITULO = "Fisioterapia e Terapia Manual em Florianópolis | Anderson Andrade";
const DESCRICAO =
  "Fisioterapia para dores na coluna, cervical e lombar em Florianópolis. Atendimento individualizado com terapia manual e avaliação fisioterapêutica, em Capoeiras e no Centro. Agende sua avaliação.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITULO, template: "%s | Anderson Andrade" },
  description: DESCRICAO,
  // O layout do painel marca tudo como noindex; aqui o site precisa ser indexado.
  robots: { index: true, follow: true },
  icons: { icon: "/img/simbolo.png", apple: "/img/simbolo.png" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: MARCA,
    url: SITE_URL,
    title: TITULO,
    description: DESCRICAO,
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
      "Atendimento fisioterapêutico individualizado em Florianópolis, com foco em dores na coluna, cervical e lombar, e terapia manual.",
    slogan: SLOGAN,
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
    <div
      className={`${nunito.variable} ${comfortaa.variable} relative z-10 min-h-screen bg-[#F5F8F7] font-corpo text-[#243635]`}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <CapturaOrigem />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#1EB49F] via-[#3CC9B4] to-[#354746]" />
      <header className="border-b border-[#DCE8E5] bg-[#F5F8F7]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Anderson Andrade, página inicial">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/simbolo.png" alt="" width={771} height={668} className="h-9 w-auto sm:h-10" />
            <span className="leading-tight">
              <span className="block font-destaque text-[17px] font-bold text-[#354746] sm:text-[20px]">
                Anderson Andrade
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#0F7F70] sm:text-[10.5px]">
                Fisioterapia e Terapia Manual
              </span>
            </span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-[14px] sm:gap-3">
            <Link href="/capoeiras" className="hidden rounded-lg px-2.5 py-2 text-[#4A5F5D] hover:text-[#354746] sm:block">
              Capoeiras
            </Link>
            <Link href="/centro" className="hidden rounded-lg px-2.5 py-2 text-[#4A5F5D] hover:text-[#354746] sm:block">
              Centro
            </Link>
            <Link href="/duvidas" className="hidden rounded-lg px-2.5 py-2 text-[#4A5F5D] hover:text-[#354746] sm:block">
              Dúvidas
            </Link>
            <Link
              href="/agendar"
              className="rounded-xl bg-[#0F7F70] px-4 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#0B6B5E]"
            >
              Agendar
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="mt-16 border-t border-[#DCE8E5] bg-[#EAF1EF]">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-[14px] text-[#4A5F5D] sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-destaque text-[17px] font-bold text-[#354746]">Anderson Andrade</p>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0F7F70]">
              Fisioterapia e Terapia Manual
            </p>
            <p className="mt-3">{PROFISSIONAL}</p>
            <p>Fisioterapeuta · {CREFITO}</p>
            <p className="mt-2">{HORARIO_TEXTO}</p>
            <p className="mt-4 font-semibold text-[#354746]">Redes sociais</p>
            <RedesSociais comTexto className="mt-2" />
          </div>
          <div>
            <p className="font-semibold text-[#354746]">Consultórios</p>
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
            <p className="font-semibold text-[#354746]">Mais</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/agendar" className="underline-offset-2 hover:underline">
                  Agende sua avaliação
                </Link>
              </li>
              <li>
                <Link href="/duvidas" className="underline-offset-2 hover:underline">
                  Dúvidas frequentes
                </Link>
              </li>
              <li>
                <Link href="/privacidade" className="underline-offset-2 hover:underline">
                  Privacidade
                </Link>
              </li>
            </ul>
            <p className="mt-5 font-destaque text-[14px] font-bold text-[#354746]">{SLOGAN}</p>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-8 text-[12.5px] leading-relaxed text-[#5E7371] sm:px-6">
          As informações deste site são educativas e não substituem a avaliação de um profissional. Em caso de
          emergência (por exemplo, perda de força súbita, dor intensa após queda, perda de controle da urina ou
          das fezes, febre com dor, falta de ar ou dor no peito), procure um pronto-socorro ou ligue 192 (SAMU).
        </p>
      </footer>
    </div>
  );
}
