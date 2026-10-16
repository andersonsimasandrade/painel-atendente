// Roda uma vez quando o servidor do painel sobe (Next.js instrumentation).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarRelogioInstagram } = await import("./lib/ig-relogio");
    iniciarRelogioInstagram();
  }
}
