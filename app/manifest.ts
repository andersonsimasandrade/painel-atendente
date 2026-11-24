import type { MetadataRoute } from "next";

// Faz o painel poder ser instalado no celular ("Adicionar à tela inicial"): abre em tela cheia, com ícone próprio, como um app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Painel · Anderson Andrade Fisioterapia",
    short_name: "Painel",
    description: "Atendimento, agenda, conversas e prontuário do consultório.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080B0A",
    theme_color: "#080B0A",
    lang: "pt-BR",
    icons: [
      { src: "/img/icone-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/img/icone-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
