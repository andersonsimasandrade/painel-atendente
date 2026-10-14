import { FACEBOOK_URL, INSTAGRAM, INSTAGRAM_URL } from "@/lib/site";

function IconeInstagram({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeFacebook({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.8v3h2.7V21h3z" />
    </svg>
  );
}

/** Ícones das redes sociais. O Facebook só aparece quando FACEBOOK_URL estiver preenchido em lib/site.ts. */
export function RedesSociais({ comTexto = false, className = "" }: { comTexto?: boolean; className?: string }) {
  const base =
    "inline-flex items-center gap-2 rounded-xl border border-[#ddd6c9] bg-white px-3 py-2 text-[14px] text-[#3a4a41] transition hover:border-[#2f9e5e] hover:text-[#14603d]";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={`Instagram @${INSTAGRAM}`} className={base}>
        <IconeInstagram />
        {comTexto ? <span>Instagram</span> : null}
      </a>
      {FACEBOOK_URL ? (
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={base}>
          <IconeFacebook />
          {comTexto ? <span>Facebook</span> : null}
        </a>
      ) : null}
    </div>
  );
}
