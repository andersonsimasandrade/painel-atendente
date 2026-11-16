// Corpo do e-mail de "WhatsApp desconectado" (urgente). Usado pelo vigia (cron) e pelo botão de teste.
import { appBaseUrl } from "./http";

const paginaConexao = () => `${appBaseUrl().replace(/\/+$/, "")}/conexao`;

export function corpoHtml(quem: string, estado: string, teste = false): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1b14">
    ${teste ? `<p style="margin:0 0 12px;padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e"><b>TESTE:</b> assim chega o aviso quando o WhatsApp cair. Nada está errado agora.</p>` : ""}
    <h2 style="margin:0 0 8px;font-size:20px;color:#b91c1c">🔴 URGENTE: WhatsApp da Fisioterapia desconectado</h2>
    <p style="margin:0 0 12px;font-size:15px;color:#111827">
      O número <b>${quem}</b> está <b>${estado}</b>. Enquanto não for reconectado, o robô <b>não recebe nem responde mensagens</b>,
      os lembretes e as confirmações <b>não saem</b>, e os clientes ficam sem atendimento.
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#374151">Para reconectar (leva 1 minuto):</p>
    <ol style="margin:0 0 18px;padding-left:20px;font-size:14px;color:#374151;line-height:1.7">
      <li>Abra o botão abaixo e clique em <b>“Gerar QR para reconectar”</b>.</li>
      <li>No celular do robô: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>.</li>
      <li>Leia o QR que aparece na tela.</li>
    </ol>
    <a href="${paginaConexao()}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:10px">Reconectar agora</a>
    <p style="margin:20px 0 0;font-size:12px;color:#6b7280">Aviso automático do painel. Se continuar desconectado, este aviso se repete a cada 30 minutos.</p>
  </div>`;
}

