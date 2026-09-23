# Reconciliação dos pipelines de Analytics

## Objetivo

Durante a migração de telemetria, o Agenda Fashion mantém dois pipelines de eventos do navegador:

- o legado `eventos_produto`;
- o Analytics V2 first-party, baseado em `analytics_sessoes`, `analytics_visualizacoes_tela` e `analytics_eventos`.

A coexistência é temporária e auditável. Os dois pipelines não devem ser somados para produzir uma métrica de produto, nem um deles deve substituir fatos transacionais como cadastro, publicação, agendamento, pagamento ou assinatura.

## Eventos comparáveis

A reconciliação administrativa compara somente eventos que possuem semântica equivalente nos dois pipelines:

| Legado | Analytics V2 |
| --- | --- |
| `perfil_visualizado` | `profile_viewed` |
| `link_negocio_copiado`, `link_negocio_compartilhado`, `link_servico_copiado`, `link_servico_compartilhado` | `profile_shared` |
| `agendamento_iniciado` | `booking_started` |
| `agendamento_concluido` | `booking_completed` |

Eventos exclusivos de um dos pipelines permanecem fora da comparação.

### Intenção de agendar novamente

`Agendar novamente` cria uma nova reserva e não deve ser confundido com
`booking_rescheduled`, que representa alteração transacional de uma reserva
existente.

Durante a coexistência dos pipelines, a intenção de repetição usa os nomes já
comparáveis:

- legado: `agendamento_iniciado` com `origem = agendar_novamente`;
- Analytics V2: `booking_started` com `intent = repeat_booking`.

O status do booking de origem pode ser enviado como contexto seguro
(`source_booking_status` no V2), mas esses eventos continuam sendo telemetria
de intenção. A recorrência real é calculada a partir de novos agendamentos não
cancelados persistidos para o mesmo `client_id`.

## Janela comparável

O histórico do pipeline legado é anterior ao Analytics V2. Comparar todo o histórico produziria uma divergência artificial.

Por isso, para cada recorte administrativo, a janela comparável começa no primeiro `analytics_eventos.occurred_at` de um evento frontend mapeado no Analytics V2. A partir desse instante são contados, separadamente:

- eventos;
- sessões distintas como diagnóstico auxiliar;
- diferença absoluta entre as duas telemetrias;
- cobertura observada do V2 sobre o legado.

A paridade técnica é avaliada pelos eventos equivalentes. Contagens de sessões não
entram no critério de paridade porque o legado e o Analytics V2 possuem contratos
de sessionização diferentes; uma diferença de sessões, isoladamente, não prova
perda de eventos.

O painel também preserva os totais do período de cada pipeline para contexto.

Paridade exata é apenas um diagnóstico técnico. Ela não autoriza, sozinha, a remoção do pipeline legado.

## Conclusão de agendamento

O nome `booking_completed` pode existir em duas origens e elas não são
intercambiáveis:

- `origem='frontend'`: telemetria de navegador usada na reconciliação da jornada;
- `origem='backend'`: fato transacional emitido somente quando o backend persiste
  a conclusão do atendimento.

A reconciliação entre pipelines continua filtrando apenas `origem='frontend'`.
O evento backend não deve ser somado ao evento de navegador e não substitui a
tabela `agendamentos`; ele é uma projeção auditável do fato persistido.

O mesmo princípio vale para os demais eventos críticos do ciclo:
`booking_created`, `booking_rescheduled`, `booking_cancelled` e
`booking_no_show`. Eles são emitidos pelo backend na mesma transação lógica da
mudança do booking, com identificadores e ator derivados do estado persistido.

Quando o frontend informa o ID retornado após a criação do agendamento, o backend:

1. normaliza o identificador;
2. confirma que o agendamento existe;
3. confirma que pertence ao mesmo negócio;
4. quando informado, confirma também o mesmo serviço;
5. só então persiste `analytics_eventos.agendamento_id`.

ID enviado pelo navegador nunca é aceito como verdade sem validação.

## Entrega resiliente

O Analytics V2 continua fail-soft: falhas de telemetria nunca bloqueiam navegação, checkout ou agendamento.

Para reduzir perda silenciosa:

- todo lote é colocado primeiro em um outbox local limitado;
- resposta HTTP não-2xx é tratada como falha;
- falhas de rede e erros transitórios mantêm o lote para retry;
- erros permanentes de contrato, atualmente HTTP 400/422, descartam o lote inválido para não bloquear a fila;
- o outbox tem TTL de 24 horas e limite de 40 lotes;
- o backend permanece idempotente pelos UUIDs únicos de visualizações e eventos.

A reconexão do navegador e novos envios tentam drenar a fila.

## Identidade de cliente

Métricas de cliente e recorrência usam `agendamentos.client_id` como identidade canônica.

`agendamentos.cliente_id` permanece vínculo legado/opcional com a conta autenticada e WhatsApp não é usado para fundir identidades. Dois visitantes com o mesmo telefone não são tratados como a mesma pessoa sem uma identidade persistida que comprove isso.

## Condições para retirar o legado

A remoção de `eventos_produto` deve acontecer somente depois de:

1. observar reconciliação estável em produção por período suficiente;
2. investigar divergências dos eventos comparáveis;
3. confirmar cobertura aceitável do Analytics V2;
4. confirmar que `booking_completed` está vinculado a agendamentos reais quando o ID estiver disponível;
5. migrar ou remover todas as leituras que ainda dependem de `eventos_produto`;
6. manter fatos transacionais como fonte canônica de conversão;
7. atualizar testes e documentação no mesmo patch de retirada.

Até lá, os dois pipelines coexistem deliberadamente.
