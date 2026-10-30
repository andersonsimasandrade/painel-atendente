# O que falta fazer — prazo: sexta-feira, 30/10/2026

Escrito em 28/10/2026. Quinta (29/10) é o dia de adiantar; sexta (30/10) é o dia de fechar.
Segunda (02/11) os anúncios entram no ar. Cada item diz **quem faz**, **onde clicar** e **como saber que deu certo**.

Regra de ouro: **nunca cole chaves, senhas ou códigos no chat com o Claude.** Cole só nas telas indicadas (EasyPanel, Google, Meta).

---

## QUINTA-FEIRA, 29/10 — adiantar

### 1. Conferir que o painel novo subiu (2 min) — VOCÊ
1. EasyPanel → projeto `automacoes` → serviço `painel` → botão **Implantar**.
2. Espere ficar verde. Pronto. (Isso coloca no ar o módulo do YouTube, ainda desligado.)

### 2. Rodar as 3 tarefas agendadas pelo menos uma vez (5 min) — VOCÊ
Elas só rodam com o app do Claude aberto e precisam da sua aprovação na primeira vez.
1. No app do Claude (desktop), menu lateral → **Agendadas**.
2. Abra cada uma e clique em **Executar agora**. Se aparecer pedido de permissão, clique em **Permitir sempre**:
   - `meta-conferir-aprovacao-28-10` (a de hoje 08:30 ficou parada; pode **Parar** e **Executar agora** de novo)
   - `meta-primeiro-dia-02-11`
   - `relatorio-semanal-anuncios`
3. Deu certo quando cada uma mostra "Concluída".

### 3. Conectar o canal do YouTube ao painel (5 min) — VOCÊ (uma vez só)
**Atualização de 29/10:** o Claude já fez 3a (projeto `painel-atendente-fisioterapia`), a API do YouTube, o escopo, o Branding, a publicação ("Em produção") e criou o cliente OAuth. Faltam só 3b (copiar ID e chave secreta para o EasyPanel) e 3c.
O Google exige que o próprio dono autorize. Faça logado na conta que é dona do canal **Anderson Simas**.

**3a. Criar o acesso no Google Cloud**
1. Abra https://console.cloud.google.com → no topo, **Selecionar projeto → Novo projeto**. Nome: `Painel Atendente` → **Criar**.
2. Menu ☰ → **APIs e serviços → Biblioteca** → procure **YouTube Data API v3** → **Ativar**.
3. Menu ☰ → **APIs e serviços → Tela de permissão OAuth** (ou "Google Auth Platform"):
   - Nome do app: `Painel Atendente`; e-mail de suporte: o seu; **Público: Externo**; e-mail de contato: o seu → salvar.
   - Em **Acesso a dados / Escopos → Adicionar escopo**: marque `.../auth/youtube.force-ssl` → salvar.
   - Em **Público**: clique **Publicar app** (status "Em produção"). Se deixar em "Teste", a autorização vence em 7 dias e o robô para.
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web** → nome `Painel`.
   - Em **URIs de redirecionamento autorizados**, cole exatamente: `https://painel.andersonandradefisio.com.br/api/youtube/callback`
   - **Criar**. Vai aparecer o **ID do cliente** e a **Chave secreta do cliente**. Deixe a janela aberta.

**3b. Colocar no painel**
1. EasyPanel → serviço `painel` → **Ambiente** → adicione duas variáveis:
   - `YOUTUBE_CLIENT_ID` = o ID do cliente
   - `YOUTUBE_CLIENT_SECRET` = a chave secreta
2. **Salvar** → **Implantar**.

**3c. Autorizar**
1. Logado no painel, abra: https://painel.andersonandradefisio.com.br/api/youtube/conectar
2. O Google pede para escolher a conta e o **canal**: escolha **Anderson Simas**.
3. Vai aparecer "O Google não verificou este app": clique **Avançado → Acessar Painel Atendente (não seguro)**. É normal, o app é seu.
4. Marque a permissão de gerenciar o YouTube → **Continuar**.
5. Deu certo quando aparece **"YouTube conectado ✅ — Canal: …"**. Me avise: eu confiro no banco e faço o teste.

### 4. Gravar o vídeo do avatar (HeyGen) (20 min) — VOCÊ
1. No HeyGen, avatar `596f654394cc4103bdb8eea145fa1990`, **idioma Português (Brasil)**, formato **vertical 9:16**, legendas ligadas, ~30 segundos.
2. Texto (já revisado nas regras do CREFITO, sem preço nem promessa):

> Olá, eu sou o Anderson Andrade, fisioterapeuta, CREFITO-10 89456-F.
> Atendo em Florianópolis, em Capoeiras e no Centro.
> Na consulta você é ouvido, examinado e recebe explicações claras sobre o que será feito, em um atendimento individual, com hora marcada.
> Se quiser marcar, escolha o melhor horário no meu site: andersonandradefisio.com.br.
> Será um prazer te atender.

3. Baixe o arquivo e **me diga onde salvou** (pasta do computador). Eu preparo o anúncio 3 e o envio ao YouTube na descrição certa.

### 5. Testar o robô do Instagram (10 min) — VOCÊ
Faça em horário de atendimento (terça a sexta, 8h–17h), com **outra conta de Instagram** (a de um amigo, ou a sua pessoal) seguindo o perfil do consultório:
1. Envie no direct: `Oi, queria saber como funciona a consulta` → o robô deve responder em até ~1 min.
2. Envie `Lindo trabalho!` → deve vir só um agradecimento.
3. Comente numa publicação: `Vocês atendem no Centro?` → deve vir resposta pública + mensagem no direct.
4. Me avise "testei". Eu confiro no banco o que chegou e o que saiu.

### 6. Primeiro artigo do blog (10 min) — VOCÊ, na Central Viral
1. Na Central Viral gere **um artigo** (sugestão de tema: "Como é a primeira consulta de fisioterapia e terapia manual"), sem promessa de resultado nem preço.
2. Confira os **fontes** e publique (status "publicado").
3. Me avise: eu testo no "Resultados avançados" do Google e coloco no sitemap.

---

## SEXTA-FEIRA, 30/10 — fechar

### 7. Conferir o YouTube funcionando (5 min) — EU, com você
Com o canal conectado e pelo menos 1 vídeo publicado: você (ou um amigo) deixa um comentário de teste no vídeo, eu confiro se o painel respondeu em até 15 minutos (das 8h às 20h).

### 8. Trocar as chaves que apareceram no chat (1 h) — VOCÊ + EU, uma de cada vez
Só depois de tudo acima estar estável. Para **cada** chave: você gera a nova na tela do serviço, cola no EasyPanel, clica **Implantar**; eu testo o robô antes de passar à próxima. Ordem:
1. **Groq** (console.groq.com → API Keys → criar nova, apagar a antiga) → painel: `GROQ_API_KEY`.
2. **Resend** (resend.com → API Keys → criar nova, apagar a antiga) → painel: `RESEND_API_KEY`.
3. **Segredos que você inventa** (eu te passo valores novos por um arquivo local, nunca no chat): `CRON_SECRET` (painel **e** credencial "Painel CRON" do n8n), `PAUSE_WEBHOOK_SECRET` (painel **e** n8n), `AGENDA_SYNC_TOKEN`, `GOOGLE_ADS_INGEST_SECRET`, `AUTH_SECRET` e `DASHBOARD_PASSWORD` (a senha de acesso ao painel).
4. **Evolution** (chave global): serviço `evolution-api` → variável `AUTHENTICATION_API_KEY` → painel `EVOLUTION_API_KEY` → credenciais do n8n "Evolution". **Esta é a mais delicada** (mexe no WhatsApp do robô): faça por último e me avise antes.
5. **Meta**: gerar de novo `META_ADS_ACCESS_TOKEN` e `META_CAPI_TOKEN` (Gerenciador de Negócios → Usuários do sistema), e o `INSTAGRAM_APP_SECRET` (Painel de desenvolvedores → app Atendente 24h Fisio → Configurações → Básico → Redefinir).
6. Depois de cada uma: me avise, eu mando mensagem de teste ao robô e confiro o painel.

### 9. Apagar o que sobrou (5 min) — VOCÊ
Na pasta do projeto, apague o arquivo `_n8n-chave-api (deixe ate terminar os ajustes do robo).txt` (chave do n8n; só depois de a etapa 8 terminar).

---

## SEGUNDA-FEIRA, 02/11 — dia de começar

1. **Cedo (antes das 8h):** recarregar o saldo do **Google Ads** (a campanha está "Limitada" por falta de saldo). Sugestão: R$ 1.000 para o mês.
2. **08:00:** os anúncios 1 e 2 da Meta entram no ar sozinhos. Nada a fazer.
3. **09:30:** a tarefa `meta-primeiro-dia-02-11` confere tudo e me deixa o relatório (com o app aberto).
4. A cada **segunda 09:30**, a tarefa `relatorio-semanal-anuncios` compara Google × Meta × YouTube por custo de cada avaliação marcada.

---

## O que EU faço (você não precisa fazer)
- Marcar `form_inicio` como evento-chave no GA4 (depois que o formulário for usado).
- Conferir no banco os testes do Instagram e do YouTube e corrigir o que falhar.
- Ligar o canal do YouTube à conta do Google Ads e criar os links com origem `youtube` (só crio campanha de vídeo quando você mandar e houver saldo).
- Montar o anúncio 3 com o vídeo do avatar (você aprova antes de publicar).
- Incluir o YouTube como linha própria no comparativo de canais, quando houver os primeiros vídeos.

## O que o robô do YouTube faz (já no código, desligado até o passo 3)
- De 15 em 15 minutos, das 8h às 20h, lê os comentários novos e **também os antigos sem resposta** (aos poucos: no máximo 10 por rodada e 80 por dia).
- Elogio ou emoji → agradecimento curto. Pergunta ou interesse → resposta pública com o link para escolher a consulta no site (com `utm_source=youtube`) + aviso no seu WhatsApp.
- Nunca fala preço, nunca promete resultado, nunca dá diagnóstico. Para desligar sem mexer em código: variável `YOUTUBE_ROBO=desligado`.
- Limite do YouTube: ele **não informa telefone nem e-mail** de quem comenta. O atendimento continua pelo site/WhatsApp, e o painel mede pela marcação `utm_source=youtube`.
