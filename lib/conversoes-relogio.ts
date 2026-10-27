import { enviarMetaPendentes } from "@/lib/conversoes";

// A cada 10 minutos: envia à Meta as conversões pendentes (só se META_CAPI_TOKEN existir).
const g = globalThis as unknown as { __conversoesRelogio?: boolean };

export function iniciarRelogioDeConversoes() {
  if (g.__conversoesRelogio) return;
  g.__conversoesRelogio = true;
  let rodando = false;
  const volta = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await enviarMetaPendentes();
      if (r.enviados || r.erros) console.log("[conversoes] Meta:", JSON.stringify(r));
    } catch (e) {
      console.error("[conversoes-relogio]", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  };
  setTimeout(volta, 4 * 60 * 1000);
  setInterval(volta, 10 * 60 * 1000);
}
