// Envio de e-mail transacional via Resend (server-only). Mesma origem do magic
// link. Usado pelos relatórios de tráfego.
// Remetente dos e-mails. O Resend SÓ envia de um domínio verificado na conta
// dele — por isso não há valor padrão: um remetente inventado seria recusado e
// o e-mail sumiria em silêncio.
//   EMAIL_REMETENTE="Sua Empresa <painel@suaempresa.com.br>"
function remetente(): string {
  return (process.env.EMAIL_REMETENTE ?? "").trim();
}

export async function enviarEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY não configurada." };
  const from = remetente();
  if (!from) {
    return {
      ok: false,
      error:
        "EMAIL_REMETENTE não configurado (ex.: \"Sua Empresa <painel@suaempresa.com.br>\", " +
        "com o domínio verificado no Resend).",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[email] Resend falhou:", res.status, t.slice(0, 300));
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] exceção:", e);
    return { ok: false, error: "Falha ao enviar o e-mail." };
  }
}
