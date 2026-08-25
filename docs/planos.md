# Planos do Agenda Fashion

Este documento registra a oferta comercial e as regras de capacidade dos
planos do Agenda Fashion. A migration e o código executável continuam sendo a
fonte de verdade quando houver divergência.

## Princípio do produto

O Agenda Fashion possui um **plano gratuito ativo**, sem cobrança e sem cartão.
Ele não é apenas uma demonstração: deve entregar valor real para que a
profissional crie o negócio, publique serviços e receba os primeiros
agendamentos antes de precisar fazer upgrade.

O crescimento para um plano pago acontece quando o negócio precisa de mais
capacidade. O plano gratuito não deve ser escondido, tratado como inexistente
ou apresentado como uma oferta paga.

## Catálogo oficial

| Plano | Valor mensal | Agendamentos/mês | Profissionais | Serviços |
| --- | ---: | ---: | ---: | ---: |
| Grátis | R$ 0,00 | 10 | 1 | 2 |
| Autônoma | R$ 49,90 | 20 | 1 | 4 |
| Studio | R$ 99,90 | 30 | 1 | 10 |
| Salão | R$ 199,90 | Ilimitados | 5 | Ilimitados |

O nome público do plano de entrada é **Grátis**. Seu slug interno permanece
`inicial` para preservar negócios, triggers e automações existentes. Os slugs
dos planos pagos são `autonoma`, `studio` e `salao`.

## O que o plano Grátis representa

Dentro dos limites do plano, a profissional pode:

- criar e configurar o negócio;
- manter um perfil público compartilhável;
- cadastrar até dois serviços;
- operar com um profissional;
- receber até dez agendamentos por mês;
- começar sem informar cartão ou gerar cobrança.

Os limites controlam novas criações e a capacidade mensal. Eles não devem
apagar dados existentes nem impedir a edição do que já foi cadastrado.

## Consumo de capacidade

- O agendamento conta no mês da data marcada.
- Os status `agendado`, `confirmado` e `realizado` consomem capacidade.
- Agendamentos cancelados não consomem capacidade.
- A lotação de um mês não bloqueia os meses seguintes.
- Limites de serviço, profissional e agendamento devem ser validados pelo
  backend, dentro da mesma transação da criação.
- `NULL` no banco representa capacidade ilimitada.

## Upgrade, pagamento e cancelamento

- O plano gratuito não exige checkout.
- Os planos pagos usam checkout por **PIX**.
- O retorno do navegador não confirma pagamento.
- O novo plano só é ativado depois da confirmação autenticada e idempotente do
  Asaas.
- O mesmo plano não deve gerar uma nova contratação duplicada.
- Ao cancelar a renovação, o acesso pago continua até o fim do período já
  quitado.
- Após o encerramento do ciclo pago, o negócio retorna ao plano gratuito.
- Antes de gerar o PIX, o checkout informa ciclo mensal, renovação,
  cancelamento, ausência de taxa de adesão e disponibiliza Termos de uso,
  Política de Privacidade e contato de suporte.

Se o uso atual estiver acima dos limites do plano gratuito após o retorno, os
dados existentes devem ser preservados. Novas criações ficam sujeitas aos
limites até que haja capacidade ou um novo upgrade.

## Comunicação e aquisição

`grátis`, `gratuito` e variações são termos compatíveis com a oferta real do
Agenda Fashion. Campanhas de aquisição não devem negativar essas buscas apenas
por indicarem interesse em uma opção sem custo.

A qualidade desse tráfego deve ser avaliada pela ativação da profissional, por
exemplo:

1. cadastro profissional concluído;
2. negócio criado;
3. primeiro serviço cadastrado;
4. agenda configurada;
5. primeiro agendamento recebido;
6. início de checkout e pagamento, quando houver upgrade.

O evento genérico `sign_up` não deve ser interpretado sozinho como assinatura
paga. Relatórios de marketing devem separar aquisição gratuita, ativação do
negócio e conversão para plano pago.

## Referências técnicas

- Catálogo e limites: `database/migrations/015_planos_limites.sql`.
- Normalização dos nomes: `database/migrations/025_corrigir_nomes_planos.sql`.
- Consulta pública: `GET /planos`.
- Oferta pública em HTML: `/planos` com `Accept: text/html`.
- Transparência: `/termos` e `/privacidade`.
- Uso do negócio: `GET /meu-plano`.
- Checkout pago: `POST /checkout`.
- Visão técnica completa: `docs/arquitetura.md`.
