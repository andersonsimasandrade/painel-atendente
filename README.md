# Painel do Atendente 24h

O painel é o outro lado do robô. O robô atende no WhatsApp; o painel é onde o
time **vê** o que ele está fazendo, **assume** a conversa quando precisa, e
acompanha o que virou negócio.

Ele não tem banco próprio: lê e escreve no mesmo Supabase que o robô usa. Quem
manda mensagem é sempre a Evolution API. Como as duas peças se combinam está em
`../PAINEL-INTEGRACAO.md` — leia aquele arquivo antes de subir este aqui.

---

## O que ele faz

Dez telas. As marcadas com **(admin)** só aparecem para quem tem papel `admin`.

| Tela | Para quê |
|---|---|
| **Dashboard** (admin) | Os números do período: funil de conversão, leads por etapa, categorias, mapa por UF, horários de maior movimento e as últimas respostas do robô |
| **Conversas** | O inbox. Todas as conversas do WhatsApp em uma lista, ao vivo. Abre a conversa, responde por texto, áudio ou arquivo, assume o atendimento (o robô se cala por 24h), marca como lida e agenda mensagem para depois |
| **Prioridades** | Quem merece atenção agora. A IA lê cada conversa e devolve resumo, temperatura (quente/morno/frio) e a próxima ação sugerida — mais um plano do dia consolidado |
| **Leads** | A base completa. Busca por nome ou telefone e filtra por situação, categoria, estágio, UF, CNPJ, desfecho e data de entrada. Cada lead tem ficha, linha do tempo, notas e desfecho |
| **Funil** | O kanban. Arrasta o card entre as colunas; ao cair numa etapa, dispara a sequência automática de mensagens daquela etapa |
| **Agenda** | As reuniões marcadas, presença e lembretes. Cada consultor tem uma página pública de agendamento em `/agendar/<slug>` |
| **Atendimento** | Os indicadores do time humano: quanto tempo o cliente espera até alguém responder (mediana e p90), produção por consultor, e quanto demora a primeira resposta depois de uma transferência |
| **Tráfego** (admin) | O retorno dos anúncios: investimento e custo por lead vindos da Meta, cruzados com quem de fato respondeu e fechou |
| **Conexão** | O status do WhatsApp de cada consultor e o QR code para religar quando cair |
| **Ajustes** (admin) | Nome do robô, assinatura, frases de anúncio que fazem ele assumir a conversa, horário de atendimento, respostas rápidas, e as colunas do kanban com a sequência de cada uma |

Fora do login existem duas páginas públicas: `/login` (entrada) e
`/agendar/<slug>` (a página onde o cliente escolhe o horário com um consultor).

---

## A stack

- **Next.js 14** (App Router, React 18, TypeScript) — as páginas são Server
  Components; o inbox é o único pedaço com estado ao vivo no navegador.
- **Tailwind CSS 3** para o visual.
- **Supabase (Postgres)** via `@supabase/supabase-js`, sempre com a chave
  `service_role`, sempre no servidor.
- **Evolution API** para enviar mensagem, áudio e arquivo pelo WhatsApp.
- **Resend** (opcional) para o login por e-mail e os relatórios.
- **Groq** e/ou **OpenAI** (opcional) para os resumos das conversas.
- **Meta Ads** (opcional) para a tela de Tráfego.

Sem dependência paga além do que você já contratou. O build sai em uma imagem
Docker *standalone* de poucas dezenas de megabytes.

---

## Como rodar no seu computador

Precisa de **Node 22 ou mais novo** — é o que a biblioteca do Supabase exige.

```bash
cd painel-atendente
npm install
cp .env.example .env.local     # no Windows: copy .env.example .env.local
# abra o .env.local e preencha (comece pelas sete obrigatórias)
npm run dev
```

Abre em `http://localhost:3000`. Entre com a senha que você colocou em
`DASHBOARD_PASSWORD`.

Rodando local, use `APP_BASE_URL=http://localhost:3000`. Os outros comandos:
`npm run build` (constrói) e `npm start` (roda o que foi construído).

O `.env.local` **nunca** vai para o Git — o `.gitignore` já bloqueia. O único
arquivo de ambiente versionado é o `.env.example`, que não tem valor nenhum
dentro.

---

## As variáveis de ambiente

São 24, organizadas em três níveis no `.env.example`:

1. **Sem estas o painel não abre** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   e `APP_BASE_URL`. São as três que o código cobra na cara: faltando qualquer
   uma, toda tela mostra o erro **com o nome da variável**.
2. **Sem estas você não entra, ou entra inseguro** — `DASHBOARD_PASSWORD`,
   `AUTH_SECRET` e `EMPRESA_NOME`.
3. **Cada uma liga uma função** — o resto. O painel sobe sem elas.

Nenhuma variável aponta para outra instalação. Onde existe um padrão, ele é
neutro e está documentado na tabela abaixo — não há endereço de banco, domínio
nem instância de terceiros escondidos no código.

| Variável | Obrigatória? | De onde vem | O que quebra se faltar |
|---|---|---|---|
| `SUPABASE_URL` | **Sim** | Supabase → Project Settings → API → "Project URL" | Todas as telas mostram "Sem conexão com o banco" |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sim** | Supabase → Project Settings → API → chave `service_role` (**não** a `anon`) | Idem. Com a chave errada o painel abre vazio, porque o RLS está ligado e a `anon` não lê nada |
| `APP_BASE_URL` | **Sim** | O endereço público do painel, sem barra no final (ex.: `https://painel.suaempresa.com.br`) | O login e os links dentro dos e-mails quebram |
| `DASHBOARD_PASSWORD` | **Sim** | Você inventa | A tela de senha responde erro 500 e ninguém entra pela porta de emergência |
| `AUTH_SECRET` | **Sim** | `openssl rand -hex 32` | Sem ele o painel cai na `DASHBOARD_PASSWORD` para assinar a sessão — trocar a senha desloga todo mundo |
| `EMPRESA_NOME` | **Sim** | O nome da sua empresa | O painel escreve "Sua Empresa" no cabeçalho, nos rodapés, nos e-mails e nos prompts da IA |
| `CRON_SECRET` | **Sim** | `openssl rand -hex 32` | As rotas `/api/cron/*` respondem 503 e **nada automático acontece**: nem sequência de funil, nem lembrete, nem alerta de queda |
| `EVOLUTION_API_URL` | Para responder | O domínio da sua Evolution API | O painel lê as conversas mas não consegue enviar nada |
| `EVOLUTION_API_KEY` | Para responder | A chave de API da Evolution | Idem |
| `EVOLUTION_INSTANCE` | Para responder | O nome da instância. Tem que ser **idêntico** aqui, no workflow do n8n e na coluna `vendedores.instancia_whatsapp` | Envio falha em silêncio e a tela Conexão não mostra o QR code |
| `PAUSE_WEBHOOK_URL` | Recomendada | O webhook do workflow "Ponte" no n8n (veja `../PAINEL-INTEGRACAO.md`) | O botão "Assumir" não cala o robô: o time responde e o robô responde junto, na frente do cliente |
| `PAUSE_WEBHOOK_SECRET` | Recomendada | Você inventa; o mesmo valor vai no n8n | O webhook responde 401 e a pausa nunca acontece |
| `PAUSE_STATE_WEBHOOK_URL` | Opcional | Só se a sua URL de leitura não for a de escrita com o final trocado por `painel-pausa-estado` | Nada — em branco, o painel deduz sozinho |
| `RESEND_API_KEY` | Opcional | resend.com → API Keys | Dá para entrar só pela senha, e nenhum relatório por e-mail sai |
| `EMAIL_REMETENTE` | Opcional | Um endereço de um domínio **verificado** no Resend, no formato `Sua Empresa <painel@suaempresa.com.br>` | O Resend recusa o envio e o e-mail some sem aviso |
| `ALERTAS_EMAIL` | Recomendada | Os e-mails de quem recebe os avisos, separados por vírgula | Ninguém é avisado quando o WhatsApp cai. O painel segue funcionando |
| `ALERTAS_WHATSAPP` | Opcional | Os telefones (só dígitos, com 55), separados por vírgula | Idem, pelo outro canal |
| `EVOLUTION_INSTANCE_ALERTAS` | Opcional | O nome de uma **segunda** instância, usada só para mandar aviso | Nada — mas leia o parágrafo abaixo desta tabela |
| `GROQ_API_KEY` | Opcional | console.groq.com (tem camada gratuita; é tentado primeiro) | As telas funcionam, só não há resumo de conversa nem plano de ação |
| `OPENAI_API_KEY` | Opcional | platform.openai.com (é a reserva do Groq) | Idem, se as duas faltarem |
| `META_ADS_ACCESS_TOKEN` | Opcional | Business Manager, com permissão de leitura de anúncios | A tela de Tráfego mostra "não configurado" em vez de números |
| `META_ADS_ACCOUNT_IDS` | Opcional | Os ids das contas de anúncio, separados por vírgula (com ou sem `act_`) | Se você anuncia em mais de uma conta e lista só uma, o investimento aparece menor do que é |
| `META_ADS_ACCOUNT_ID` | Opcional | Nome antigo, para uma conta só. Prefira o de cima | Nada, se você usou o `META_ADS_ACCOUNT_IDS` |
| `INICIO_PROJETO` | Opcional | A data em que sua operação começou (`AAAA-MM-DD`) | O painel usa os últimos 90 dias como piso da janela "Desde o início" |

> **Sobre o `EVOLUTION_INSTANCE_ALERTAS`:** o aviso mais útil do sistema é
> "o WhatsApp caiu" — e quem caiu é justamente o número que mandaria o aviso.
> Se você tem um número só, preencha o `ALERTAS_EMAIL`: o e-mail é o único
> caminho que sobrevive à queda.

Para gerar um segredo aleatório sem `openssl`, no PowerShell:

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

---

## As 18 tabelas

Todas criadas pelo `../BANCO-supabase.sql`, num arquivo só, que pode ser rodado
quantas vezes você quiser.

| Tabela | O que guarda |
|---|---|
| `ff_contatos` | A ficha do lead. É a tabela central: telefone, nome, etapa do funil, categoria, cidade/UF, resumo da IA, dono e desfecho |
| `ff_mensagens` | Log cru das mensagens, para auditoria. O painel **não** lê daqui |
| `ff_eventos` | Eventos do funil (mudou de etapa, enviou material). Alimenta a linha do tempo e o gráfico de conversão |
| `n8n_chat_histories` | A memória da conversa. É o que aparece na tela Conversas — e a fonte dos indicadores de atendimento |
| `dashboard_usuarios` | Quem pode entrar no painel, com o papel (`admin` ou `vendedor`) |
| `magic_tokens` | Os links de login por e-mail. Uso único, expiram sozinhos |
| `vendedores` | Os consultores: instância do WhatsApp, disponibilidade e a agenda pública em `/agendar/<slug>` |
| `agendamentos` | As reuniões marcadas, pelo robô ou pelo painel |
| `ff_notas` | Anotações internas do time sobre o lead |
| `funil_etapas` | As colunas do kanban (7 de fábrica; você renomeia, recolore e cria novas) |
| `funil_etapa_msgs` | A sequência automática de cada etapa: "quando cair aqui, manda isso em X minutos" |
| `funil_envios` | A fila dessas sequências. O cron `/api/cron/funil` consome |
| `msgs_agendadas` | As mensagens que o time agenda na mão ("manda isso amanhã às 9h") |
| `respostas_rapidas` | Os atalhos de texto do inbox |
| `painel_config` | Os ajustes globais, numa linha só: nome do robô, assinatura, gatilhos e horário de atendimento |
| `prioridades_meta` | O plano de ação gerado pela IA — um por dono (geral e por consultor) |
| `trafego_diario` | O snapshot diário de investimento em anúncios cruzado com os leads |
| `rate_events` | O freio contra abuso nas rotas públicas (agendamento e login por e-mail) |

---

## Deploy

**Na sua VPS (EasyPanel + Docker).** A pasta já traz o `Dockerfile`: Next.js em
modo *standalone*, porta **3000**, rodando como usuário sem privilégio. As
variáveis são lidas em tempo de execução — você constrói a imagem uma vez e
troca as chaves depois, sem reconstruir.

```bash
docker build -t painel-atendente .
docker run -p 3000:3000 --env-file .env painel-atendente
```

O passo a passo completo no EasyPanel (fonte, porta, variáveis, domínio e
HTTPS) está em `../PAINEL-INTEGRACAO.md`, seção D. Dois avisos que estão lá e
vale repetir: o build precisa de **internet** (o Next baixa as fontes do
Google), e numa VPS pequena o `next build` pode ser morto por falta de memória
— nesse caso, construa a imagem em outro lugar e aponte o EasyPanel para a
imagem pronta.

**Na Vercel.** Importe o repositório, defina o **Root Directory** como
`painel-atendente`, cole as mesmas variáveis e faça o deploy. O `Dockerfile` é
ignorado nesse caminho. É o jeito mais rápido de ver o painel no ar.

Nos dois casos, quem chama as tarefas de horário é o n8n, não a plataforma:
veja a seção C do `../PAINEL-INTEGRACAO.md`.

---

## Papéis: admin e vendedor

O papel vem da coluna `papel` em `dashboard_usuarios`.

| | **admin** | **vendedor** |
|---|---|---|
| Vê | tudo | só os leads com o `vendedor_slug` dele |
| Telas | todas | Conversas, Prioridades, Leads, Funil, Agenda, Atendimento e Conexão |
| Não acessa | — | Dashboard, Tráfego e Ajustes |

Quem tem papel `vendedor` **precisa** ter `vendedor_slug` preenchido — o banco
recusa a linha sem isso, de propósito: um vendedor sem dono definido veria a
base inteira.

O bloqueio não é só de menu. Ele acontece no middleware (o servidor redireciona
a página e responde 403 nas APIs) e de novo em cada rota que age sobre um lead
específico. Esconder o botão não é segurança.

**A senha (`DASHBOARD_PASSWORD`) entra sempre como admin.** É o acesso de
emergência, para você — não para o time. O time entra pelo link no e-mail.

---

## Pontos de adaptação

O kit é um ponto de partida com opinião. Isto aqui é o que se espera que mude
de negócio para negócio:

| Onde | O que mudar |
|---|---|
| `lib/theme.ts` | As **categorias de lead** (`PERFIL_ORDER`) — é o vocabulário com que a IA classifica quem está do outro lado —, os **rótulos e cores das etapas** do funil e os **desfechos** do atendimento. As três listas são o vocabulário do seu negócio |
| `lib/resumo.ts` | O **prompt** que lê a conversa e preenche a ficha do lead. Se você mudou as categorias no `theme.ts`, mude aqui também (e em `lib/types.ts`): os três precisam falar a mesma língua |
| `lib/materiais.ts` | Os **PDFs que o time manda com um clique** no inbox (catálogo, tabela, proposta). Suba os arquivos onde quiser — Supabase Storage, S3, um Drive público — e coloque o link direto. Lista vazia esconde o botão |
| `lib/config.ts` | O nome da empresa e quem recebe os alertas. Na prática você só mexe nas variáveis de ambiente que ele lê (`EMPRESA_NOME`, `ALERTAS_EMAIL`, `ALERTAS_WHATSAPP`, `EVOLUTION_INSTANCE_ALERTAS`) |
| Tela **Ajustes** | Nome do robô, assinatura, frases de anúncio, horário de atendimento, respostas rápidas e as colunas do kanban. Isso muda pela tela, sem tocar em código |

As **chaves** das etapas (`novo`, `qualificando`, `materiais_enviados`,
`roteado`, `politica_enviada`, `agendado`, `transferido`) são contrato entre o
robô, o banco e o painel. Os **rótulos** são livres. Mudou uma chave, mude nos
três lugares: `funil_etapas` (banco), `lib/theme.ts` e o prompt do robô.

---

## Segurança — leia antes de subir

**A chave `service_role` só existe no servidor.** Ela ignora todas as travas do
banco: quem tem essa chave lê e escreve qualquer linha de qualquer tabela.

- Nunca a coloque numa variável que comece com `NEXT_PUBLIC_` — tudo que começa
  assim vai para o navegador do usuário, e de lá para qualquer um.
- Nunca importe `lib/db.ts`, `lib/evolution.ts` ou `lib/painel-pausa.ts` em um
  Client Component (arquivo com `"use client"` no topo). Esses módulos leem
  segredos do ambiente.
- Se ela vazar, gire a chave no Supabase e troque a variável nos dois lugares
  que a usam: o painel e o n8n.

**O RLS está ligado em todas as tabelas, e sem nenhuma policy.** Foi de
propósito. Traduzindo: a chave pública (`anon`) **não lê nada** — nem que alguém
descubra a URL do seu Supabase. O único jeito de ler é pela `service_role`, que
mora no servidor do painel e no n8n.

O efeito colateral: se você configurar o painel com a chave `anon` por engano,
ele **abre vazio e não reclama** — tudo consulta, tudo volta zero. Um painel
vazio que parece funcionando é o pior dos dois mundos, então confira essa chave
antes de sair procurando bug em outro lugar.

**Os outros cuidados que já vêm ligados:** o cookie de sessão é `httpOnly` e
`secure` em produção; a tela de senha tem freio de 8 tentativas a cada 10
minutos por IP; as rotas `/api/cron/*` ficam fora do login mas exigem o
`Authorization: Bearer <CRON_SECRET>`; e a página pública de agendamento manda
`Referrer-Policy: no-referrer`, para o telefone que está na URL não vazar pelo
cabeçalho `Referer`.
