import { rodarLembreteInstagram } from "@/lib/ig-lembrete";
import { manterTokenIG } from "@/lib/ig-token";
import { rodarComentariosYT } from "@/lib/yt-robo";

// Relógio interno: roda o lembrete do Instagram a cada 15 minutos enquanto o painel estiver no ar.
// Se houver mais de uma cópia do painel rodando, o lembrete nunca sai em dobro (cada contato é "reivindicado" no banco antes do envio).
const g = globalThis as unknown as { __igRelogio?: boolean };

export function iniciarRelogioInstagram() {
  if (g.__igRelogio) return;
  g.__igRelogio = true;
  const volta = async () => {
    try {
      const r = await rodarLembreteInstagram();
      if (r.enviados) console.log(`[ig-relogio] lembretes enviados: ${r.enviados}`);
    } catch (e) {
      console.error("[ig-relogio]", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(volta, 2 * 60 * 1000); // primeira volta 2 min depois de subir
  setInterval(volta, 15 * 60 * 1000);

  // Renovação da chave do Instagram (vale 60 dias): confere ao subir e a cada 12 horas.
  const chave = async () => {
    try {
      await manterTokenIG();
    } catch (e) {
      console.error("[ig-token]", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(chave, 3 * 60 * 1000);
  setInterval(chave, 12 * 3600 * 1000);

  // Comentários do YouTube: a cada 15 minutos (só atua com o canal conectado e entre 8h e 20h).
  const youtube = async () => {
    try {
      const r = await rodarComentariosYT();
      if (r.respondidos) console.log(`[yt-robo] comentários respondidos: ${r.respondidos}`);
    } catch (e) {
      console.error("[yt-robo]", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(youtube, 4 * 60 * 1000);
  setInterval(youtube, 15 * 60 * 1000);
}
