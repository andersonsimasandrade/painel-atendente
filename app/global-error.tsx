"use client";

import { useEffect } from "react";

/**
 * Último recurso: erro no próprio layout raiz, onde o app/error.tsx não chega.
 * Substitui <html>/<body>, então não tem acesso aos tokens do painel nem às
 * fontes — daí o estilo inline, no tom escuro da marca.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[painel] erro no layout raiz:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b0a",
          color: "#e9f1ec",
          fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
            O painel não carregou
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", lineHeight: 1.6, color: "#8d9a93" }}>
            Foi uma falha no carregamento da página inteira. Tente de novo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              height: "44px",
              padding: "0 20px",
              borderRadius: "8px",
              border: "none",
              background: "#35b06e",
              color: "#04140d",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
          {error.digest && (
            <p style={{ marginTop: "20px", fontSize: "11px", color: "#8d9a93" }}>
              código: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
