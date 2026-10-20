// Tipos globais do Google Tag Manager / Consent Mode usados no site público.
export {};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
