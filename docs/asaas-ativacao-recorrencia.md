# Ativação financeira e recorrência no Asaas

## Objetivo

A ativação de um plano pago não deve manter transações ou locks do PostgreSQL abertos enquanto o Agenda Fashion aguarda chamadas HTTP mutáveis do Asaas.

Essa regra evita combinar, na mesma unidade de falha, dois sistemas que não compartilham uma transação distribuída. Uma chamada aceita pelo Asaas não pode ser revertida automaticamente pelo rollback do PostgreSQL, e uma transação local não deve permanecer bloqueando linhas enquanto depende da latência da rede.

## Fronteira transacional

A ativação por pagamento confirmado usa uma saga curta em cinco momentos:

1. **preparação local**: o pagamento é conciliado de forma idempotente, o contexto da assinatura é lido e o negócio é brevemente serializado para descartar uma ativação já obsoleta antes de qualquer efeito mutável no provedor;
2. **efeito no provedor**: quando necessário, a recorrência mensal é criada ou reconciliada no Asaas fora da transação do banco;
3. **finalização local**: o negócio é serializado novamente, o pagamento é revalidado contra a ordem dos webhooks, assinaturas concorrentes são desativadas, a assinatura alvo é ativada e `negocios.plano_id` é atualizado em uma transação curta;
4. **limpeza no provedor**: recorrências substituídas são canceladas no Asaas depois do commit local;
5. **compensação**: se uma recorrência acabou de ser criada no Asaas, mas a finalização local deixou de ser aplicável, ela só é removida quando não existe vínculo local com seu `asaas_subscription_id`.

Nenhuma chamada a `criarAssinaturaAsaas` ou `removerAssinaturaAsaas` pode ocorrer dentro de `db.executarTransacao` no fluxo público de ativação.

## Idempotência e recuperação

`webhook_eventos` continua sendo o dono durável do retry do webhook. Não existe uma segunda fila financeira apenas para a ativação.

Eventos do mesmo `(provedor, recurso_id)` são reservados de forma serial pela fila. Assim, eventos diferentes da mesma cobrança, como `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`, não executam simultaneamente a etapa externa de criação de recorrência. A serialização acontece somente no ato de reservar o evento e não mantém lock do banco enquanto o Asaas é chamado.

A recorrência usa `externalReference` estável no formato:

```text
assinatura:<assinatura_id>;negocio:<negocio_id>;plano:<plano_id>
```

Assim, um retry pode reconciliar a mesma recorrência no Asaas em vez de criar uma assinatura mensal diferente.

Quando a assinatura local já possui `asaas_subscription_id`, a confirmação de uma renovação reutiliza esse vínculo e não cria uma nova recorrência.

As recorrências substituídas são marcadas localmente como `CANCELED` com a observação de substituição. Essa marca torna a limpeza recuperável: se o DELETE no Asaas falhar depois do commit, o webhook pode tentar novamente sem depender de estado apenas em memória.

Uma confirmação que já é obsoleta no preflight não cria recorrência. Quando o evento veio do worker do webhook e a assinatura alvo ainda não possui vínculo local, o AF faz somente uma consulta por `externalReference`; se encontrar uma recorrência externa sem qualquer vínculo local, remove-a. Isso permite limpar uma recorrência órfã deixada por uma tentativa anterior sem criar uma nova apenas para compensá-la.

## Ordem dos webhooks

A finalização revalida `webhookEventoCriadoEm` e `webhookEventoId` por meio da mesma proteção temporal de `pagamentos`.

Se um evento financeiro mais novo já venceu a corrida, a confirmação antiga não ativa novamente a assinatura nem troca o plano. Quando uma assinatura ativa mais nova já existe no mesmo negócio, o preflight impede um novo efeito mutável no Asaas; se a disputa só for percebida depois da etapa externa, a recorrência recém-criada passa pela compensação.

Para o worker financeiro, esses casos retornam `null` e o evento é concluído como `IGNORED`. Assim uma confirmação obsoleta não é interpretada como nova conversão de assinatura para Meta ou Google.

## Concorrência por recurso e por negócio

Existem duas fronteiras complementares:

- a fila serializa a reserva de eventos que possuem o mesmo `(provedor, recurso_id)`, evitando efeitos externos concorrentes para a mesma cobrança;
- a finalização serializa a troca de plano usando a linha de `negocios` como fronteira comum, evitando que duas assinaturas alvo diferentes do mesmo negócio sejam ativadas simultaneamente.

Os locks continuam limitados às etapas locais. O Asaas nunca é aguardado enquanto esses locks estão abertos.

## Falhas depois do commit

A ativação local pode concluir e a limpeza de uma recorrência anterior falhar por timeout ou erro HTTP. Nesse caso, o processamento do webhook falha e permanece elegível ao retry de `webhook_eventos`.

No retry:

- a assinatura alvo já vinculada é reutilizada;
- nenhuma nova recorrência é criada quando o vínculo local já existe;
- a marca local das recorrências substituídas permite repetir o DELETE;
- o DELETE é idempotente, inclusive quando o Asaas responde que a assinatura já não existe;
- uma recorrência órfã de tentativa anterior pode ser reconciliada por `externalReference` antes de um evento obsoleto ser encerrado como `IGNORED`.

A conversão de marketing só é enfileirada depois que a ativação retorna com sucesso, portanto uma falha de limpeza não é registrada antecipadamente como assinatura concluída no pipeline de marketing.

No frontend, pagamento `CONFIRMED` ou `RECEIVED` não é suficiente para
anunciar que o plano já foi atualizado. Enquanto a assinatura local ainda não
estiver `ACTIVE` e `ativo = true`, a interface deve informar que o pagamento
foi confirmado e que a ativação ainda está sendo concluída.

## Organização do código

`src/services/assinaturaService.js` é a fachada pública do domínio de assinaturas.

O comportamento histórico foi isolado em `assinaturaServiceCore.js` para preservar os fluxos que não participam desta mudança. A ativação financeira pública é substituída por `assinaturaAtivacaoAsaasService.js`, e o SQL específico da saga fica em `assinaturaAtivacaoRepository.js`.

Código novo não deve importar `assinaturaServiceCore.js` para executar a ativação antiga. Esse módulo existe como núcleo de compatibilidade dos demais fluxos enquanto a ativação segura é exposta exclusivamente pela fachada pública.

## Invariantes de teste

Os testes da saga e da fila devem proteger pelo menos estes comportamentos:

- criação e remoção de recorrências ocorrem com a transação local encerrada;
- renovação com `asaas_subscription_id` existente não cria outra recorrência;
- evento obsoleto antes da chamada ao provedor não cria uma nova recorrência;
- evento obsoleto depois da chamada ao provedor não ativa a assinatura;
- recorrência recém-criada e sem vínculo local é compensada;
- recorrência órfã já existente pode ser reconciliada por leitura antes de ignorar o evento;
- pagamento sem vínculo/aplicabilidade não chama o Asaas;
- a finalização bloqueia o negócio antes de efetivar a troca de plano;
- dois eventos concorrentes do mesmo recurso não ficam simultaneamente em `PROCESSING`.
