import type { Metadata } from "next";
import { ASSISTENTE_ATIVO, MARCA, PROFISSIONAL, CREFITO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o site e o atendimento por WhatsApp tratam os seus dados (LGPD).",
  alternates: { canonical: "/privacidade" },
};

export default function Privacidade() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <h1 className="font-destaque font-bold text-[30px] font-semibold leading-tight tracking-tight text-[#354746] sm:text-[40px]">
        Política de privacidade
      </h1>
      <p className="mt-3 text-[14px] text-[#5E7371]">Atualizada em outubro de 2026.</p>

      <div className="mt-8 space-y-7 text-[15.5px] leading-relaxed text-[#3F5452]">
        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Quem somos</h2>
          <p className="mt-2">
            {MARCA}, de {PROFISSIONAL} ({CREFITO}), em Florianópolis/SC. É o responsável pelos dados tratados
            neste site e no atendimento por WhatsApp.
          </p>
        </div>

        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">O que este site guarda</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Nenhum dado de saúde.</strong> O site não pede sintomas, diagnósticos nem exames.
            </li>
            <li>
              As suas preferências ao pedir um agendamento: consultório, dias e período. Elas ficam ligadas a um
              código curto que vai na mensagem de WhatsApp.
            </li>
            <li>
              De onde você chegou (por exemplo, um anúncio do Google, do Instagram ou uma busca). Essa
              informação fica guardada no seu navegador por até 30 dias e só é enviada quando você pede o
              agendamento. Serve para sabermos quais anúncios funcionam.
            </li>
          </ul>
          <p className="mt-2">
            Não usamos pixels de remarketing nem vendemos dados. Para apagar a informação guardada no navegador,
            limpe os dados do site nas configurações dele.
          </p>
        </div>

        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Atendimento por WhatsApp</h2>
          <p className="mt-2">
            {ASSISTENTE_ATIVO
              ? "Ao enviar a mensagem, você conversa primeiro com um assistente virtual da equipe. Ele ajuda a organizar as informações (nome, queixa principal, disponibilidade) e repassa ao fisioterapeuta, que confirma o agendamento. As conversas ficam armazenadas em sistemas de atendimento usados pela clínica, com acesso restrito. O assistente não faz diagnóstico e não substitui a avaliação."
              : "Ao enviar a mensagem, você conversa diretamente com o fisioterapeuta, que confirma o agendamento. A conversa fica no aplicativo WhatsApp do profissional, com acesso restrito a ele, e é usada apenas para o seu atendimento."}
          </p>
        </div>

        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Atendimento pelo Instagram</h2>
          <p className="mt-2">
            Se você escrever no direct ou comentar em uma publicação do perfil @andersonandrade_fisio, o conteúdo da sua
            mensagem, o seu nome de usuário e o código que o Instagram atribui à sua conta são recebidos pelo nosso sistema
            de atendimento, usados apenas para responder a você e mantidos com acesso restrito. Não pedimos sintomas,
            diagnósticos nem exames nesse canal: para isso, o atendimento segue pelo WhatsApp ou na sessão.
          </p>
        </div>

        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Para que usamos os dados</h2>
          <p className="mt-2">
            Para responder a você, organizar a agenda, prestar o atendimento, emitir recibos e melhorar o
            serviço. A base legal é o seu pedido de contato e a execução do atendimento (LGPD, art. 7º).
          </p>
        </div>

        <div>
          <h2 className="text-[18px] font-semibold text-[#354746]">Os seus direitos</h2>
          <p className="mt-2">
            Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, e retirar o
            consentimento. Basta mandar uma mensagem pelo WhatsApp da clínica ou pelo direct do Instagram dizendo o que
            deseja, ou seguir as instruções em{" "}
            <a href="/exclusao-de-dados" className="font-bold text-[#0F7F70] underline-offset-2 hover:underline">
              exclusão de dados
            </a>
            . Dados de
            prontuário podem ter prazo mínimo de guarda definido pelo conselho profissional.
          </p>
        </div>
      </div>
    </section>
  );
}
