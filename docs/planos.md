# Planos do Agenda Fashion

> **Papel documental:** fonte canônica para catálogo, entitlement, limites e comportamento de upgrade/downgrade. Checkout, ativação Asaas e webhooks ficam nos documentos técnicos especializados ligados em `docs/README.md`.

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
- Os status `agendado`, `confirmado`, `realizado` e `falta` consomem capacidade.
- Agendamentos cancelados não consomem capacidade.
- A lotação de um mês não bloqueia os meses seguintes.
- Limites de serviço, profissional e agendamento devem ser validados pelo
  backend, dentro da mesma transação da criação.
- Apenas vínculos de equipe com `ativo = TRUE` consomem
  `limite_profissionais`.
- Um convite aceito sem vaga pode permanecer como vínculo
  `aguardando_vaga_plano`; esse estado não concede acesso operacional, não
  recebe agendamentos e não consome capacidade.
- Liberar capacidade ou concluir um upgrade não ativa automaticamente pessoas
  aguardando vaga. A dona escolhe quem ativar, e o backend revalida o limite no
  momento da ativação.
- Quando um downgrade reduz `limite_profissionais` abaixo da quantidade de
  vínculos ativos, a proprietária permanece ativa e o backend inativa apenas o
  excedente de profissionais não proprietárias, começando pelas ativações mais
  recentes. O vínculo e as reservas existentes são preservados.
- Vínculos inativados por downgrade usam
  `motivo_inatividade = 'excedente_limite_plano'` e podem ser reativados pela
  proprietária quando houver capacidade.
- `NULL` no banco representa capacidade ilimitada.

## Upgrade, pagamento e cancelamento

- O plano gratuito não exige checkout.
- Os planos pagos usam checkout por **PIX**.
- O backend só inicia checkout pago para a proprietária ativa de um negócio
  ativo e com `negocios.publicado = TRUE`; navegação, botão ou URL do frontend
  não substituem essa validação.
- A confirmação/personalização manual dos horários não é gate financeiro. A
  primeira jornada pode ordenar a tela de Horários antes do checkout sem fazer
  de `agenda_configuracoes` uma autoridade de billing.
- O retorno do navegador não confirma pagamento.
- O novo plano só é ativado depois da confirmação autenticada e idempotente do
  Asaas.
- O mesmo plano não deve gerar uma nova contratação duplicada.
- O mesmo negócio não pode manter dois PIX de contratação/upgrade pendentes ao
  mesmo tempo, mesmo quando as cobranças apontam para planos diferentes.
- Um upgrade pendente não substitui visualmente nem operacionalmente o plano
  vigente antes da confirmação financeira.
- Ao cancelar a renovação, o acesso pago continua até o fim do período já
  quitado.
- Após o encerramento do ciclo pago, o negócio retorna ao plano gratuito.
- O fim de um período já pago com renovação cancelada não depende de nova
  navegação da proprietária: os background workers fazem reconciliação em
  background e reutilizam a mesma operação transacional usada pela leitura do
  plano. Retry ou concorrência não podem duplicar
  `ACESSO_PAGO_ENCERRADO`.
- A API de assinatura normaliza o ciclo para estados de domínio como
  `PENDENTE`, `ATIVA`, `FALHA_DE_PAGAMENTO` e `CHECKOUT_EXPIRADO`,
  preservando também o status bruto do provedor para auditoria.
- `FALHA_DE_PAGAMENTO` mantém compatibilidade como código agregado, mas expõe
  `tipo_falha` para distinguir `COBRANCA_ATRASADA` de
  `REVERSAO_OU_DISPUTA`.
- Em cobrança atrasada, a conta pode oferecer a `invoiceUrl` persistida da
  cobrança do Asaas para regularização. A URL só é exposta quando usa HTTPS e
  domínio oficial do Asaas; o retorno da fatura nunca substitui a confirmação
  por webhook.
- O atraso suspende o entitlement pago imediatamente conforme a regra financeira
  existente. Para lifecycle e churn, a inadimplência permanece recuperável por
  uma janela padrão de 14 dias. Sem recuperação depois dessa janela, o AF
  materializa `ACESSO_PAGO_ENCERRADO` com motivo
  `INADIMPLENCIA_NAO_RECUPERADA`. Pagamento posterior inicia reativação; ele
  não apaga a saída terminal anterior.
- Estorno, desfazimento de recebimento e chargeback não devem mostrar CTA de
  "pagar novamente" como se fossem simples atraso.
- Um checkout inicial vencido ou encerrado sem confirmação não libera benefício
  pago; a assinatura pendente é encerrada e o plano gratuito continua vigente.
- Assinatura com renovação cancelada e período ainda pago permanece ativa até a
  data persistida. A interface apresenta essa data como `Acesso até`, não
  `Próxima cobrança`.
- Transições financeiras novas também são registradas em
  `assinatura_eventos` com chave idempotente. Conversão inicial, renovação,
  reativação, mudança de plano, atraso, recuperação, reversão, cancelamento da
  renovação e encerramento do acesso pago não são tratados como equivalentes.
- Desde a Wave 25, fatos monetários mensais preservam o valor contratado no
  próprio lifecycle. O MRR v1 usa `assinaturas.valor` como snapshot do contrato
  e não relê `planos.valor` para reinterpretar o passado. Mudança de plano ou
  de valor recorrente gera expansion, contraction ou movimento lateral pelo
  delta monetário efetivo. Atraso recuperável mantém MRR em risco até uma saída
  terminal; `ACESSO_PAGO_ENCERRADO` leva o valor mensal a zero. New MRR não
  entra na NRR da base inicial.
- O **LTV bruto observado v1** da Wave 26 usa pagamentos efetivamente observados
  do mesmo negócio em D30, D60 e D90 a partir da primeira conversão paga
  canônica pós-cutover. Troca de plano, nova assinatura técnica, churn e
  reativação não criam um novo customer lifetime. Coorte imatura não vira zero;
  permanece indisponível até completar a janela. Reversões são exposição
  separada e não autorizam calcular LTV líquido sem o valor exato persistido.
- A **aquisição financeira v1** da Wave 27 congela por negócio a primeira dona,
  a atribuição first-touch e a campanha resolvida quando a primeira conversão
  paga canônica é reconciliada. CAC de mídia observado usa investimento diário
  maduro da campanha e reutiliza a fonte única já persistida por campanha/dia;
  uma nova fonte substitui a anterior conforme a migration 037. Desde a migration
  098, o próprio custo preserva `objetivo_snapshot`, impedindo que uma mudança
  posterior entre campanha de profissional/cliente reclassifique silenciosamente
  o histórico. Negócio pago maduro sem custo correspondente bloqueia a
  comparação. Retorno D30/D60/D90 é
  receita bruta observada sobre mídia da mesma coorte e não deve ser chamado de
  payback econômico.
- A **economia líquida de gateway v1** da Wave 28 é reconciliada separadamente do
  billing. O AF preserva o `netValue` observado no Asaas e mantém um ledger
  idempotente de refunds. Ausência de `netValue` não vira taxa zero; somente
  refund `DONE` reduz receita. A fórmula canônica é `netValue - refunds DONE`.
  Refund pendente, chargeback em disputa e reversão não conciliada bloqueiam a
  leitura líquida correspondente. A métrica não é lucro nem margem de
  contribuição.
- A **margem de contribuição observada v1** da Wave 29 possui infraestrutura
  própria de fontes, ledger de custos variáveis e cobertura contínua. A migration
  100 não cadastra nenhuma fonte por suposição. A margem só pode ser exibida
  quando houver ao menos uma fonte obrigatória ativa e todas as fontes cobrirem a
  janela consultada; fora dessa condição, custo ausente permanece desconhecido,
  nunca zero. O **LTV de contribuição D30/D60/D90** reutiliza a primeira conversão
  paga e maturidade da Wave 26, exige economia de gateway reconciliada e bloqueia
  a janela quando qualquer negócio maduro estiver economicamente incompleto. A
  taxa do gateway e refunds da Wave 28 não são descontados de novo, e investimento
  de mídia continua separado como CAC de mídia. Lucro, CAC total, payback
  econômico e LTV:CAC definitivo permanecem fora do contrato.
- A **Wave 30** conecta a contribuição observada ao **CAC de mídia** da
  aquisição oficial. O retorno só aparece para coortes pós-cutover com mídia
  canônica, maturidade suficiente, gateway reconciliado e cobertura integral
  das fontes obrigatórias. A primeira recuperação usa somente D30/D60/D90; não
  há interpolação de dias. A leitura não é CAC total, lucro ou payback econômico
  definitivo e permanece indisponível enquanto não existir fonte real
  obrigatória de custo variável.
- A **Wave 31** operacionaliza fontes factuais de custo variável sem criar
  seed ou estimativa. Escritas são restritas a superadmin, exigem motivo e ficam
  auditadas em ledger append-only. Débitos são idempotentes por fonte+chave,
  correções administrativas usam crédito referenciado limitado ao saldo do
  débito, e cobertura não pode regredir. Enquanto fonte/cobertura factual não
  existir, margem, LTV de contribuição e retorno continuam indisponíveis.
- `webhook_eventos` preserva a entrega do provedor; `assinatura_eventos`
  preserva o fato de domínio do AF. O histórico anterior à migration 093 não é
  preenchido por suposição.
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
3. primeiro serviço cadastrado e ativo;
4. negócio publicado;
5. primeiro agendamento válido recebido;
6. início de checkout e pagamento, quando houver upgrade.

A disponibilidade é inicializada automaticamente ao criar o negócio e pode ser
acompanhada como qualidade operacional, mas não é etapa obrigatória de ativação
nem requisito de publicação.

O evento genérico `sign_up` não deve ser interpretado sozinho como assinatura
paga. Relatórios de marketing devem separar aquisição gratuita, ativação do
negócio e conversão para plano pago.

## Referências técnicas

- Catálogo e limites: `database/migrations/015_planos_limites.sql`.
- Estado de equipe aguardando capacidade:
  `database/migrations/084_profissionais_aguardando_vaga.sql`.
- Ordem de ativação e inativação por downgrade:
  `database/migrations/086_profissionais_downgrade_plano.sql`.
- Normalização dos nomes: `database/migrations/025_corrigir_nomes_planos.sql`.
- Consulta pública: `GET /planos`.
- Oferta pública em HTML: `/planos` com `Accept: text/html`.
- Transparência: `/termos` e `/privacidade`.
- Uso do negócio: `GET /meu-plano`.
- Checkout pago: `POST /checkout`.
- Lifecycle financeiro: `database/migrations/093_assinatura_eventos_lifecycle.sql`.
- Cutover e índices de LTV observado:
  `database/migrations/097_ltv_observado_v1.sql`.
- Snapshot de aquisição financeira e cutover de retorno:
  `database/migrations/098_aquisicao_financeira_v1.sql`.
- Economia líquida de gateway e ledger de refunds:
  `database/migrations/099_economia_liquida_gateway_v1.sql`.
- Custos variáveis observados e cobertura da margem de contribuição:
  `database/migrations/100_margem_contribuicao_observada_v1.sql`.
- Cutover do retorno de contribuição sobre CAC de mídia:
  `database/migrations/101_retorno_contribuicao_cac_midia_v1.sql`.
- Operação e auditoria de fontes factuais de contribuição:
  `database/migrations/102_fontes_contribuicao_operacionais_v1.sql`.
- Baseline de episódios pagos e churn v1:
  `database/migrations/095_churn_v1_episodios_pagos.sql`.
- Ledger monetário, baseline de MRR e NRR v1:
  `database/migrations/096_mrr_v1_ledger.sql`.
- Índice da reconciliação temporal:
  `database/migrations/094_assinaturas_canceladas_expiracao_idx.sql`.
- Visão técnica completa: `docs/arquitetura.md`.
