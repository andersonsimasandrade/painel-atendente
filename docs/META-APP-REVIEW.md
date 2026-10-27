# Revisão do app da Meta — Atendente 24h Fisio (27/10/2026)

App: **Atendente 24h Fisio** — ID `1439202318174552` (modo: Publicado desde 16/10/2026).
Caso de uso: "Gerenciar mensagens e conteúdo no Instagram" (API do Instagram com login do Instagram).

## O que foi corrigido hoje
- Ícone 1024×1024 enviado (o aviso "Não qualificado para envio" sumiu).
- Política de privacidade, exclusão de dados e e-mail de contato já estavam preenchidos.
- Criada a página pública **/termos** (precisa de deploy). Depois do deploy, troque no app
  (Configurações do app → Básico) o campo **URL dos Termos de Serviço** de `.../privacidade` para
  `https://andersonandradefisio.com.br/termos` e preencha **Domínios do aplicativo** com `andersonandradefisio.com.br`.

## Situação das permissões
Todas estão em "Pronto para teste" = **acesso padrão**. Funciona só para quem tem função no app
(administrador, desenvolvedor, testador). Usadas pelo robô (chamadas nos últimos dias):

| Permissão | Chamadas | Para quê |
|---|---|---|
| instagram_business_basic | 335 | ler perfil da conta |
| instagram_business_content_publish | 138 | publicar post (Central Viral) |
| instagram_business_manage_insights | 108 | métricas |
| instagram_business_manage_messages | 57 | responder o direct |
| instagram_business_manage_comments | 31 | responder comentário |

`ads_management`, `ads_read` e as demais **não são usadas** pelo robô: não peça.

## O que isso significa na prática (CORRIGIDO em 27/10, tarde)
O banco mostra que o direct **já chega de pessoas sem função no app** (várias contas diferentes, desde 16/10) e o robô responde.
Em modo Publicado, um app que usa só a **conta do próprio consultório** funciona com acesso padrão.
**A análise do app (acesso avançado) NÃO é necessária** para o robô atender os pacientes. Só será necessária se o app passar a
atender contas de OUTRAS empresas. Por isso a verificação da empresa e os vídeos ficam **parados**, sem urgência.

O risco real era outro: a **chave de acesso do Instagram vale 60 dias** e o painel não a renovava (em 21/10 houve falhas por "chave inválida").
Foi criada a renovação automática (tabela `ig_credencial`, relógio a cada 12 h, aviso por e-mail se falhar).

## Roteiro do vídeo (1 vídeo por permissão, 1–2 minutos, com tela do celular e do painel)
**manage_messages:** (1) outra conta do Instagram manda um direct para @andersonandrade_fisio; (2) mostrar a mensagem chegando
no painel (aba Instagram); (3) mostrar a resposta automática chegando no celular da pessoa.
**manage_comments:** (1) outra conta comenta num post; (2) mostrar o comentário no painel; (3) mostrar a resposta pública e o direct.
Narre em inglês ou deixe legendas em inglês.

## Texto para colar em "Como seu app usa esta permissão" (inglês, os revisores leem em inglês)
**instagram_business_manage_messages**
> Our app is an internal assistant for a physiotherapy clinic (Anderson Andrade Fisioterapia, Florianópolis, Brazil). It receives direct messages sent to the clinic's own Instagram business account and replies with general scheduling information (location, how to book an appointment). It never gives medical advice or prices. A human can take over any conversation in our dashboard at any time. We only use messages sent to the clinic's account, only to answer the person who wrote, and we do not send unsolicited messages.

**instagram_business_manage_comments**
> Our app reads comments on the clinic's own Instagram posts and replies to people who ask questions, inviting them to continue the conversation by direct message. We do not delete or hide comments automatically and we do not use comment data for any other purpose.

**instagram_business_basic**
> Used to identify the clinic's connected Instagram business account (username and account ID) so that messages and comments can be matched to the right account.

## Perguntas de uso de dados (o formulário pede)
- Dados guardados: texto das mensagens, nome de usuário e ID do Instagram, só para atender a pessoa.
- Exclusão: https://andersonandradefisio.com.br/exclusao-de-dados (prazo de 15 dias).
- Privacidade: https://andersonandradefisio.com.br/privacidade
- Nenhum dado é vendido ou compartilhado para publicidade.

## Depois de aprovado
- Teste o fluxo real com uma conta sem função no app (direct, comentário, curtida na foto).
- Só então troque as chaves vazadas, uma por vez, com teste do robô após cada troca.
