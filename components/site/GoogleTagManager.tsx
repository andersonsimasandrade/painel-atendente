import Script from "next/script";
import { GTM_ID } from "@/lib/site";
import "@/components/site/gtm-tipos";

// Google Tag Manager com Modo de Consentimento (Consent Mode v2).
// Tudo começa NEGADO: nenhuma tag grava cookie de medição ou de anúncio até a
// pessoa aceitar no aviso do site (AvisoCookies). Personalização de anúncios
// (remarketing) fica sempre negada, por ser um serviço de saúde.
// A escolha fica no navegador (localStorage "site-consent-v1").
export function GoogleTagManager() {
  const js = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
try{if(localStorage.getItem('site-consent-v1')==='granted'){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',analytics_storage:'granted'});}}catch(e){}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;
  return <Script id="gtm" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: js }} />;
}

/** Trecho <noscript> do GTM (para quem navega sem JavaScript). Vai logo no início do corpo da página. */
export function GoogleTagManagerNoscript() {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
