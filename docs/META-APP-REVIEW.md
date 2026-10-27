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

## O que isso significa na prática
Com acesso padrão, o direct e os comentários **de pessoas sem função no app** não chegam ao robô.
Para atender pacientes de verdade, é preciso **acesso avançado** em, no mínimo:
`instagram_business_manage_messages` e `instagram_business_manage_comments`
(e `instagram_business_basic`, que acompanha). `content_publish` e `manage_insights` funcionam na própria
conta com acesso padrão, não precisam de análise.

## Pontos que travam o envio (decisão sua)
1. **Verificação da empresa.** O app pertence ao portfólio **Clinical Mobile Inova Tec**, mas a conta de anúncios e a
   página do consultório estão no portfólio **Anderson Andrade Fisio**. A Meta exige verificação da empresa dona do app
   para dar acesso avançado. Decida qual das duas será verificada (precisa de CNPJ e documentos) e, se for a do consultório,
   o app precisa ser movido para ela.
2. **Vídeo de demonstração** de cada permissão (screencast). Eu não consigo gravar; roteiro abaixo.
3. O app precisa estar **funcionando** na hora da análise (a equipe da Meta testa). Não troque chaves durante a análise.

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
