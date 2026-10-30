import { redirect } from "next/navigation";
import { SubNav } from "@/components/SubNav";
import { YoutubeBoard, type ComentarioYT } from "@/components/YoutubeBoard";
import { getClient } from "@/lib/db";
import { ehAdmin } from "@/lib/session";
import { credencialYT, youtubeConfigurado } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function YoutubePage() {
  if (!(await ehAdmin())) redirect("/prioridades");
  const configurado = youtubeConfigurado();
  const cred = configurado ? await credencialYT().catch(() => null) : null;
  const r = cred
    ? await getClient()
        .from("yt_comentarios")
        .select("comentario_id, video_id, autor_nome, texto, publicado_em, status, erro, respondido_em")
        .order("publicado_em", { ascending: false })
        .limit(100)
    : { data: [] };
  const comentarios = (r.data ?? []) as ComentarioYT[];
  const desligado = (process.env.YOUTUBE_ROBO ?? "").trim().toLowerCase() === "desligado";
  return (
    <div className="relative z-[1] min-h-screen">
      <SubNav title="YouTube" subtitle={cred ? `Canal ${cred.canal_nome ?? ""} · comentários e respostas` : "Canal ainda não conectado"} />
      <main className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
        <YoutubeBoard configurado={configurado} conectado={!!cred} desligado={desligado} canal={cred?.canal_nome ?? null} comentarios={comentarios} />
      </main>
    </div>
  );
}
