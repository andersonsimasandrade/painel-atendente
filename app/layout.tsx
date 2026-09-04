import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atendente 24h · Painel",
  description:
    "Painel de atendimento e captação de leads por WhatsApp.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Era um valor único escuro: quem ligava o modo claro no celular ficava com a
  // barra de status/endereço PRETA em cima de uma página branca, como se o tema
  // não tivesse terminado de carregar. O script anti-flash abaixo também
  // atualiza esta meta, porque a escolha salva pode contrariar o sistema.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080B0A" },
    { media: "(prefers-color-scheme: light)", color: "#F3F7F4" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="antialiased">
        {/* Aplica o tema salvo ANTES da pintura (evita o flash escuro→claro). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("painel-tema");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);' +
              'var m=document.querySelector(\'meta[name="theme-color"]:not([media])\')||document.head.appendChild(Object.assign(document.createElement("meta"),{name:"theme-color"}));' +
              'm.setAttribute("content",t==="light"?"#F3F7F4":"#080B0A");}}catch(e){}' +
              // Modo demonstração aplicado ANTES da pintura, igual ao tema: se
              // entrasse só depois da hidratação, o dado do lead apareceria
              // nítido por uma fração de segundo — e numa gravação isso é um
              // quadro legível.
              'try{var d=localStorage.getItem("painel-demo");if(d==="ident"||d==="tudo")document.documentElement.setAttribute("data-demo",d);}catch(e){}',
          }}
        />
        {children}
      </body>
    </html>
  );
}
