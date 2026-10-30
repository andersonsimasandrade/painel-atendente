# Indicações de parceiros (Estética Arlete, Espaço Beira-Mar e outros)

Painel → **Indicações** (só admin). Sem bonificação por enquanto (confirmar com o CREFITO-10 antes de oferecer dinheiro ou sessão).

## Duas entradas
1. **Link do WhatsApp** — `https://andersonandradefisio.com.br/p/<codigo>`: abre o WhatsApp do consultório com "Fui indicado(a) por <Parceiro>…" e um código curto; o robô liga a conversa ao registro e a origem fica "indicação" + parceiro. Quem chama é o paciente.
2. **Formulário** — `https://andersonandradefisio.com.br/indicar/<codigo>`: o parceiro informa nome e WhatsApp do paciente (+ caixa "a pessoa autorizou o contato"). O lead é cadastrado na hora com origem "indicação" daquele parceiro.

Códigos de fábrica: `estetica-arlete`, `espaco-beira-mar`. Parceiros novos: tela Indicações → "Cadastrar parceiro" (o código sai do nome).

## Fila "um clique"
- A indicação do formulário **espera 6 h** (variável `INDICACAO_LATENCIA_HORAS`, de 1 a 24) e, se cair fora de 8h–20h, vai para as 8h seguintes.
- Ao ficar **pronta**, o painel avisa no WhatsApp do dono (uma vez, só entre 8h e 20h). Depois de 24 h pronta, o cartão fica âmbar ("esfriando").
- Você revisa o texto e clica **Enviar mensagem**. Nada sai sozinho.
- Proteções do número: só 8h–20h; no máximo 8 primeiras mensagens por dia; se o paciente já escreveu por conta própria, a indicação vira "escreveu sozinho(a)" e nada é enviado; duplicadas em 30 dias são ignoradas.
- O texto enviado fica gravado na conversa (o robô passa a saber de onde a pessoa veio).

## Relatório por parceiro
Indicações (formulário), leads (link + formulário + cadastro manual), consultas marcadas e quem compareceu.

## Cadastro manual
Em Leads → "Cadastrar lead", escolhendo "Indicação", aparece a lista de parceiros.
