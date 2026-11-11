/** Ilustração do cabeçalho: documento da avaliação com selo de "entregue" (devolutiva). */
export function IlustracaoDevolutiva({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 124" className={className} role="img" aria-label="Documento com o resultado da sua avaliação">
      <ellipse cx="62" cy="116" rx="46" ry="5" fill="#E3ECEA" />
      <rect x="22" y="14" width="78" height="98" rx="10" fill="#F5F8F7" stroke="#354746" strokeWidth="2.5" />
      <rect x="45" y="6" width="32" height="15" rx="5" fill="#354746" />
      <circle cx="61" cy="13.5" r="2.6" fill="#F5F8F7" />
      {/* coluna: remete à fisioterapia */}
      <g fill="#1EB49F">
        <rect x="34" y="34" width="15" height="8" rx="3" />
        <rect x="35.5" y="45" width="12" height="8" rx="3" />
        <rect x="34" y="56" width="15" height="8" rx="3" />
        <rect x="35.5" y="67" width="12" height="8" rx="3" />
      </g>
      <g stroke="#B8CCC8" strokeWidth="3" strokeLinecap="round">
        <line x1="58" y1="38" x2="88" y2="38" />
        <line x1="58" y1="49" x2="84" y2="49" />
        <line x1="58" y1="60" x2="88" y2="60" />
        <line x1="58" y1="71" x2="78" y2="71" />
      </g>
      <line x1="34" y1="92" x2="70" y2="92" stroke="#354746" strokeWidth="2" strokeLinecap="round" />
      {/* selo de entregue */}
      <circle cx="98" cy="92" r="21" fill="#1EB49F" stroke="#fff" strokeWidth="3.5" />
      <polyline points="88,92 95.5,99.5 109,84" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
