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
| Grátis | R$ 0,00 | 10 | 1 | 5 |
| Autônoma | R$ 10,00 | 20 | 3 | 10 |
| Studio | R$ 20,00 | 30 | 6 | 15 |
| Salão | R$ 30,00 | Ilimitados | 9 | Ilimitados |

O nome público do plano de entrada é **Grátis**. Seu slug interno permanece
`inicial` para preservar negócios, triggers e automações existentes. Os slugs
dos planos pagos são `autonoma`, `studio` e `salao`.

## O que o plano Grátis representa

Dentro dos limites do plano, a profissional pode:

- criar e configurar o negócio;
- manter um perfil público compartilhável;
- cadastrar até cinco serviços;
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

## Upgrade contextual

O AF pode oferecer o próximo plano dentro da área da proprietária quando existe
um sinal operacional de necessidade, sem transformar o produto em uma vitrine
permanente de upsell.

Gatilhos prioritários:

- serviço ativo no limite do plano;
- profissional aceita/inativada aguardando capacidade;
- agenda mensal em 90% ou 100% da capacidade;
- consulta explícita à tela de Plano e assinatura.

A ordem de progressão é `Grátis → Autônoma → Studio → Salão`. Quando o
negócio ainda usa o Grátis efetivo, mas já possui um plano pago selecionado e
nenhuma assinatura ativa ou pendente, essa intenção persistida prevalece sobre
o próximo tier automático. A resolução do plano de destino, preço e capacidades
pertence ao backend. O frontend apenas
apresenta a oportunidade recebida e nunca reconstrói preço, limite ou
elegibilidade.

Uma assinatura paga antiga pode possuir `assinaturas.valor` maior que o preço
atual do próximo tier. Nesse caso a recomendação automática fica indisponível
para não incentivar uma redução de MRR tratada visualmente como expansão. O
catálogo geral continua acessível para decisão explícita da proprietária.

As superfícies contextuais registram impressão e seleção com origem do gatilho.
Esses eventos são intenção comercial e devem ser reconciliados com checkout,
pagamento confirmado e entitlement ativo antes de qualquer leitura de conversão
ou receita.

## Upgrade, pagamento e cancelamento

- O plano gratuito não exige checkout.
- Os planos pagos usam checkout por **PIX**.
- A tentativa guarda o valor contratado em `assinaturas.valor`. Ao retomar a
  mesma tentativa, o PIX reutiliza esse snapshot mesmo se o catálogo mudar.
  Uma tentativa nova confronta o preço atual no backend antes de criar a
  assinatura pendente.
- Antes de persistir o pagamento, o backend confere o valor e, quando presentes,
  a referência, o cliente e a forma da cobrança retornada pelo Asaas. Valores
  divergentes impedem exibir o PIX como válido. Na primeira ativação paga, o
  valor persistido do pagamento e o valor recebido no webhook, quando presente,
  são comparados com `assinaturas.valor` antes de conceder o plano.
- A elegibilidade é revalidada sob locks transacionais sobre a conta e o negócio
  antes de criar a assinatura: dona ativa, vínculo ativo, negócio ativo e
  publicado, plano válido e preço coerente. Falha de revalidação não permite
  iniciar o PIX.
- A recorrência PIX não é débito automático. A cada ciclo pode existir nova
  cobrança, que precisa ser paga; o retorno da página não confirma renovação.
- O backend só inicia checkout pago para a proprietária ativa de um negócio
  ativo e com `negocios.publicado = TRUE`; navegação, botão ou URL do frontend
  não substituem essa validação.
- A confirmação/personalização manual dos horários não é gate financeiro. Na
  primeira jornada, concluir Horários leva à divulgação do perfil e não dispara
  checkout automático. Upgrade e checkout permanecem ações explícitas ou
  contextuais posteriores, sem fazer de `agenda_configuracoes` uma autoridade
  de billing.
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
- A **Wave 32** prepara sincronização automática provider-agnostic dessas
  fontes. O registry de produção permanece vazio até existir provedor factual
  comprovável. Integrações não armazenam segredos, worker é opt-in, execução é
  serializada por integração e cursor/cobertura só avançam junto com o lote
  reconciliado. Ausência de adaptador continua indisponível, nunca custo zero.
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
- Sincronização automática de custos factuais:
  `database/migrations/103_sync_custos_contribuicao_v1.sql`.
- Baseline de episódios pagos e churn v1:
  `database/migrations/095_churn_v1_episodios_pagos.sql`.
- Ledger monetário, baseline de MRR e NRR v1:
  `database/migrations/096_mrr_v1_ledger.sql`.
- Índice da reconciliação temporal:
  `database/migrations/094_assinaturas_canceladas_expiracao_idx.sql`.
- Visão técnica completa: `docs/arquitetura.md`.


## Reativação idempotente da renovação

Enquanto o período já pago permanecer válido, a dona pode reativar a renovação
sem cobrança imediata. Cada tentativa usa `assinaturas.reativacao_tentativa` e
referência externa determinística. Encontrar uma recorrência não basta para
adotá-la: geração, acesso vigente e data externa precisam ser conferidos. Desde
a migration 118, a obrigação externa fica em `assinatura_renovacao_operacoes`,
independente do status financeiro e de `ativo`. Timeout não comprova ausência;
HTTP com o Asaas permanece fora das transações PostgreSQL.

Os UPDATEs de restauração e finalização exigem a mesma tentativa que originou
a operação. A versão é obrigatória, positiva e conferida junto do status; uma
resposta obsoleta produz no-op, inclusive se outra reconciliação já tiver
restaurado o cancelamento e a dona iniciado a tentativa seguinte. Uma referência
determinística por tentativa não substitui essa proteção da persistência.

Desde a migration 117, a reserva congela `reativacao_inicio_cobranca` a partir
da data observada dentro do UPDATE. A referência externa usa esse dia até o fim
da tentativa, mesmo se um recebimento ampliar o acesso durante a espera. Reservas
legadas sem snapshot mantêm o fallback da data persistida; se receberem um
pagamento durante a tentativa, o snapshot é capturado antes de ampliar o período.
O DTO da conta não expõe esse metadado nem a versão interna da chave do ledger.

A confirmação financeira preserva `REACTIVATING`, o ID ainda persistido e a
geração. Ela pode ampliar o acesso quitado, mas somente a finalização ou
reconciliação da tentativa pode vincular a nova recorrência e marcar a renovação
como ativa. Eventos de assinatura recebidos para a recorrência anterior durante
essa reserva são ignorados para não sobrescrever a intenção. Finalização mantém
o maior fim de acesso conhecido. Falha externa ambígua continua recuperável pela
mesma referência, sem criar outra recorrência.

O cancelamento também confere atomicamente o `asaas_subscription_id` removido
e a `reativacao_tentativa` observada (zero na geração inicial). A chamada externa
continua fora da transação. Se um webhook já permitiu reativar e iniciar outro
ciclo, a resposta antiga não altera esse ciclo e não registra outro fato. A API
responde `409` com `codigo = ASSINATURA_ALTERADA`; a dona consulta o estado atual
antes de decidir uma nova ação. Confirmação do webhook antes da resposta do
DELETE permanece válida quando recorrência e geração ainda são as mesmas.

A validação inicial do cancelamento exige evidência temporal antes do DELETE externo.
Depois da resposta, a transação bloqueia primeiro o negócio e depois a assinatura,
revalida recorrência/geração/estado e relê os pagamentos nessa conexão. Essa ordem
é compartilhada com a finalização financeira. O fim pago resulta do maior período
entre recebimentos válidos e o acesso já persistido; IDs ou recebimentos antigos
não encurtam esse fim. A janela de 12 pagamentos da tela não limita essa evidência.
Um pagamento processado após o cancelamento também amplia
o acesso legítimo sem restaurar a renovação.

Sem contexto válido para consultar o provedor, a reconciliação preserva a
operação e o estado financeiro atual, registrando um aviso seguro. Falta de
contexto não comprova ausência externa nem libera outra criação às cegas.

### Período pago e operação externa independentes

`assinaturas.acesso_pago_ate` guarda o fim exclusivo do acesso quitado. A
migration 118 copia o fim conhecido no rollout; confirmações válidas estendem
esse campo. Eventos de programação alteram `data_proxima_cobranca`, sem reduzir
acesso. Uma data futura em checkout ainda não ativo não comprova pagamento.
Cancelamento, expiração, capacidade, ledger e projeções usam o fim pago.

Desde a migration 119, `renovacao_cancelada` guarda a intenção independentemente
do status financeiro. Cancelamento, exclusão e inativação da recorrência a
preservam; recebimentos posteriores restauram somente o acesso que comprovarem.
Estorno e atraso não fazem um ID removido voltar a representar renovação ativa.
Somente uma reativação explicitamente pedida e conferida limpa o marcador.
Inativação externa não encerra o período ainda quitado nem reduz a equipe.

`acesso_pago_reconciliado` distingue o máximo legado de uma projeção dos
pagamentos atualmente válidos. Falha financeira recalcula essa projeção dentro
da transação, desconsiderando a cobrança invalidada e conservando outras
coberturas confirmadas. Ela pode reduzir ou limpar `acesso_pago_ate`, ao
contrário de um evento de programação. Depois desse marco, a data histórica e a
programação externa não são fallback financeiro. Um recebimento de ciclo já
vencido é registrado sem recuperar benefícios de outro ciclo estornado.
Recebimento realmente novo e vigente continua permitindo recuperação.

Novas assinaturas criadas pelo checkout usam a projeção desde o início. Sem
cobertura vigente, a confirmação não cria recorrência nem ativa benefícios.
O fim é exclusivo e a comparação usa o dia do banco. Os marcadores de intenção
e de reconciliação são internos e não aparecem no DTO da conta.

A migration recupera cancelamentos identificáveis da geração atual; fatos de
gerações anteriores não cancelam uma renovação posterior. Ela preserva os
benefícios e o ledger existentes no rollout e não inventa pagamentos ou
concessões para estados históricos sem evidência.

No DTO, `acesso_pago_ate` é explícito. Para compatibilidade, quando o status é
`CANCELED`, `CANCELLED` ou `REACTIVATING`, `data_proxima_cobranca` também apresenta
o fim pago, como nos clientes anteriores; isso não modifica a programação no
banco. Para `ACTIVE`, a tela mostra a data conhecida do provedor como próxima
cobrança. A tela cancelada/reativando usa o fim pago como **Acesso até**.

`assinatura_renovacao_operacoes` persiste assinatura, geração, referência, início
reservado, recorrência anterior, novo ID quando conhecido e obrigação de
resolução. O vínculo anterior permite reconhecer recebimentos atrasados sem
aceitar eventos antigos de assinatura como alterações da recorrência atual.

| Estado da operação | Significado | Recuperação |
| --- | --- | --- |
| `PENDING` | Resultado da criação precisa ser conferido | Consultar a referência original; adotar somente se geração, acesso e data coincidirem. |
| `REMOVING` | Recorrência conhecida não deve permanecer ativa | Remover o mesmo ID; falha preserva a obrigação. |
| `COMPLETED` | Recorrência conferida e vinculada | Pagamento da recorrência anterior que amplie o acesso pode reabrir conferência. |
| `CANCELED` | Ausência ou remoção confirmada | Resposta antiga com ID externo reabre apenas sua remoção, sem alterar a geração atual. |

Cada execução usa uma concessão de dois minutos e versão monotônica, conferida
nas continuações. Uma resposta de execução anterior ainda registra o ID criado
para tratamento, mas não pode adotar ou cancelar uma tentativa posterior.

Se o período crescer durante a criação, a recorrência incompatível é removida
antes de outra criação. O pedido pode fazer **uma substituição automática**, com
nova geração e referência. Nova mudança ou falha retorna pendência para consulta.
GET e worker não criam recorrências: resolvem a existente e, após remoção,
permitem que a dona reative na data correta. A remoção de uma preparação não é
um novo cancelamento voluntário no ledger.

A integração usa remoção da assinatura, pois alterar `nextDueDate` não altera
vencimentos de faturas já geradas. O contrato do Asaas informa que remover a
assinatura também remove cobranças pendentes/vencidas, preservando as pagas:
[atualização](https://docs.asaas.com/reference/atualizar-assinatura-existente) e
[remoção](https://docs.asaas.com/reference/remover-assinatura).

Na reativação, a geração é reservada antes de confirmar a remoção da recorrência
anterior, inclusive se o provedor a marcou apenas como inativa. Só depois do
DELETE confirmado pode ocorrer uma criação. Falha deixa a tentativa durável
para conferência; GET/worker não iniciam a criação. Essa confirmação adicional
é idempotente também para um ID anteriormente removido.

Estorno, atraso ou chargeback durante criação podem suspender o acesso, mas não
apagam a operação externa. Um webhook de criação com referência e cliente
corretos registra o ID sem antecipar adoção, permitindo reconhecer pagamento da
nova recorrência antes da resposta HTTP original.

O acesso vence na data quitada mesmo durante `REACTIVATING` ou falha de consulta;
não existe carência implícita. O worker expira benefícios, reconcilia a equipe e
continua resolvendo a operação mesmo com assinatura inativa. As transações locais
bloqueiam negócio antes de assinatura/operação, sem manter locks em chamadas
externas. Checkout e arquivamento aguardam a resolução da operação.

A conta expõe `renovacao_pendente`, inclusive quando o plano efetivo já voltou
ao grátis, e oferece atualização por GET. O status agregado `REATIVANDO` impede
oferta de upgrade contextual enquanto a renovação está sendo conferida.

Falhas da recuperação persistem `ultima_falha_em` e `ultimo_erro_codigo` na mesma
versão da operação, sem corpo de resposta ou credenciais. O worker solicita
propagação da falha, contabiliza o negócio e continua o lote. GET preserva a
pendência e a apresentação recuperável. Disputa normal de execução não conta
como falha; a fila `renovacoes_assinatura` na saúde operacional mostra pendentes,
falhas ainda não resolvidas e idade do item mais antigo. Operações concluídas
saem desses totais, conservando seu registro histórico.

A seleção do lote de renovação usa a última tentativa persistida, com ID como
desempate. Falhas de contexto aguardam 15 minutos na seleção automática; demais
falhas aguardam dois minutos. GET continua permitindo conferência antes desse
backoff, respeitando a concessão. Falhas no começo do lote não conservam prioridade
por terem IDs menores. A ordem não depende de cursor em memória.

Desde a migration 120, `assinatura_checkout_operacoes` também mantém a obrigação
de conciliar a criação inicial e remover recorrências substituídas. Estorno não
retira essas operações da recuperação. A conta, o bloqueio de novas operações,
o worker e o arquivamento consideram as pendências. GET/worker podem adotar uma
criação existente a partir de pagamento ainda válido ou remover a órfã; não
iniciam uma criação. Ver `asaas-ativacao-recorrencia.md`.

## Datas de calendário da cobrança

`data_proxima_cobranca`, `acesso_pago_ate`, `data_vencimento` e `data_pagamento` representam dias
civis. O parser padrão do `pg` devolve `DATE` como um objeto `Date` à meia-noite no fuso do
processo. A normalização financeira aceita esse formato e texto de data válido,
confere o calendário real e extrai os campos locais do `Date`. Converter esse
objeto para UTC antes da extração pode mudar o dia em fusos positivos.

O mesmo contrato vale para reativação, reconciliação, fallback de cancelamento
e preservação do acesso no webhook. Cancelar a renovação preserva acesso e
equipe até o fim pago; vencimento real continua retornando ao grátis e aplicando
capacidade. O cálculo do fim do período considera pagamentos `CONFIRMED`,
`RECEIVED` e `RECEIVED_IN_CASH` com `data_pagamento` válida, usando vencimento
válido se necessário. Ambos são normalizados como dias civis antes de somar o
ciclo, preservando o maior fim conhecido. Um recebimento sem datas não impede
considerar outro recebimento válido; sem essa evidência, usar o fim válido já
persistido na assinatura. Cobrança pendente não
comprova extensão do acesso. Sem qualquer data confiável, retornar conflito
antes do DELETE externo. `null` nunca representa janeiro de 1970.

Nos três endpoints da conta (`GET /minha-assinatura`, `DELETE /minha-assinatura`
e `POST /minha-assinatura/reativar`), os campos civis são normalizados antes de
`res.json` para `AAAA-MM-DD` ou `null`. Isso inclui `acesso_ate`, pagamentos,
pagamento recuperável e assinatura/pagamento de upgrade pendente. Instantes
`TIMESTAMPTZ`, como criação e confirmação observada, mantêm a precisão temporal.
Atualização sem `paymentDate` e `confirmedDate` preserva `data_pagamento`
conhecida. A observação usa `confirmacao_observada_em`; o relógio do processamento
não substitui o dia financeiro nem concede outro mês. Vencimento válido pode
fundamentar o cálculo quando a data financeira estiver ausente.

Data ausente ou incompatível recebe indicação explícita na UI sem interromper
as ações da assinatura; a UI não tenta adivinhar o dia de um ISO legado ambíguo.

`RENOVACAO_CANCELADA` usa o dia civil canônico em `detalhes.acesso_ate`. A chave
de novos ciclos é `assinatura:<id>:RENOVACAO_CANCELADA:geracao:<n>:recorrencia:<id>`.
Conta e webhook do mesmo cancelamento geram um fato, com origem e motivo do
primeiro registro. Reativar e cancelar novamente gera outro fato mesmo que a
data do acesso seja a mesma; ampliar o período não cria outro cancelamento.

`renovacao_chave_versao` faz o cutover: a migration 117 marca linhas preexistentes
com zero e preserva o formato legado desse ciclo; novas assinaturas usam um.
Reserva ou finalização de reativação adota um para o novo ciclo. Os fatos antigos
não são reescritos, apagados ou associados especulativamente a outra geração.

O checkout inicial e o caminho financeiro legado usam o mesmo cálculo mensal
de `assinaturaCalculos`, normalizando os campos SQL `DATE` antes de calcular.
Não existe mais um calculador mensal próprio na saga de ativação.

A correção é localizada no domínio de cobrança e não troca o parser global de
`pg`. Os testes usam o parser instalado em processos UTC, São Paulo, Los Angeles
e Kiritimati, além das integrações com SQL.


## Recuperação da tela de assinatura

Após cancelamento ou reativação confirmados, a tela adota a assinatura retornada
antes da consulta de atualização. Status derivado antigo não pode contradizer
esse resultado. Somente uma alteração fica disponível até a reconciliação
terminar; consultas pertencem à geração atual e são invalidadas por nova consulta,
alteração ou saída. Conclusão de uma escrita após a saída não inicia outro GET.

Falha da leitura depois de sucesso mantém o estado confirmado e oferece
`Atualizar assinatura`, que faz apenas GET. Resultado incerto e conflito de
reativação e `ASSINATURA_ALTERADA` no cancelamento também exigem consulta antes
de repetir a ação. Rejeição de validação do cancelamento permanece dentro da
confirmação. `REACTIVATING` é exibido como
`Reativando renovação`, com atualização disponível, sem liberar cancelamento ou
outra tentativa de reativar enquanto o processamento persistir.

Isso complementa a idempotência financeira do backend; uma atualização da tela
nunca reenvia a operação de cobrança/renovação.
