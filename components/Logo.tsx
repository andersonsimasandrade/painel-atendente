/**
 * Marca do painel: um balão de conversa com um relógio dentro — "atendimento
 * 24 horas". Desenhado em SVG puro (nenhuma imagem), então acompanha o tema e
 * não pesa no carregamento.
 *
 * >>> ADAPTE: troque por sua logo quando quiser. Se for usar um arquivo de
 *     imagem, coloque em public/ e substitua o <svg> por um <img>. <<<
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" role="img">
      <defs>
        <linearGradient id="a24-badge" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F2A20" />
          <stop offset="1" stopColor="#08130E" />
        </linearGradient>
        <linearGradient id="a24-bubble" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#52C98A" />
          <stop offset="1" stopColor="#2F9E5E" />
        </linearGradient>
        <radialGradient id="a24-glow" cx="0.5" cy="0.42" r="0.55">
          <stop stopColor="#35B06E" stopOpacity="0.55" />
          <stop offset="1" stopColor="#35B06E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#a24-badge)" />
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="13"
        stroke="rgba(129,214,174,0.28)"
        strokeWidth="1"
      />
      <circle cx="24" cy="23" r="15" fill="url(#a24-glow)" />

      {/* Balão de conversa, com o rabinho embaixo à esquerda. */}
      <path
        d="M15 11h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H23l-7.2 5.4A0.8 0.8 0 0 1 14.6 38l0.4-5h-0.0A5 5 0 0 1 10 28V16a5 5 0 0 1 5-5Z"
        fill="url(#a24-bubble)"
      />

      {/* Relógio: 24 horas de atendimento. */}
      <circle cx="24" cy="22" r="7.2" stroke="#08130E" strokeWidth="1.7" opacity="0.85" />
      <path
        d="M24 17.4V22l3.4 2.2"
        stroke="#08130E"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
