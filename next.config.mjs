/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build compacto para rodar em container (EasyPanel/Docker): gera
  // .next/standalone com um server.js que não precisa do node_modules inteiro.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting is decoupled from the production build so a missing lint config
    // never blocks a deploy. Run `npm run lint` separately if desired.
    ignoreDuringBuilds: true,
  },
  async headers() {
    // Defesa em profundidade: a página pública de agendamento carrega o
    // telefone (e o token de convite) na URL — no-referrer evita que a URL
    // vaze via header Referer p/ terceiros.
    return [
      {
        source: "/agendar/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
