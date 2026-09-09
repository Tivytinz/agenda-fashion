# Próxima ação de ativação do Agenda Fashion

## Objetivo

A próxima ação de ativação orienta a dona do negócio para o passo obrigatório mais importante até o primeiro agendamento válido, isto é, um agendamento que não esteja cancelado.

Ela existe para reduzir abandono entre criação do negócio, serviço ativo, publicação e primeiro agendamento. Essa camada é uma máquina de estados determinística: não é IA, não usa LLM e não deve ser apresentada ao usuário como inteligência artificial.

## Fonte de verdade

A decisão é feita no backend a partir do estado canônico do negócio:

- `possui_servico_ativo`: existe ao menos um registro ativo em `servicos_negocio` para o negócio;
- `negocio_publicado`: `negocios.publicado = TRUE`;
- `primeiro_agendamento_recebido`: existe ao menos um agendamento não cancelado para o negócio. O nome do campo é preservado por compatibilidade, mas um cancelamento deixa de encerrar a ativação se não existir outro agendamento válido.

O frontend não deve recalcular a próxima etapa usando visitas ao perfil, métricas de conversão, pendências de publicação ou outras heurísticas.

## Ordem das transições

A prioridade oficial é:

1. `GARANTIR_SERVICO_ATIVO`
2. `REVISAR_PUBLICACAO`
3. `CONQUISTAR_PRIMEIRO_AGENDAMENTO`
4. `ATIVADO`

A ordem é deliberada e também protege estados legados ou regressões operacionais. Um negócio que já recebeu agendamento, mas perdeu todos os serviços ativos, volta para `GARANTIR_SERVICO_ATIVO`. Disponibilidade não altera essa ordem: o AF a inicializa automaticamente e a profissional pode personalizá-la depois.

## Contrato do dashboard

`GET /dashboard-dono` continua expondo `ativacao` e acrescenta `proxima_acao_ativacao`.

Exemplo:

```json
{
  "ativacao": {
    "possui_servico_ativo": true,
    "negocio_publicado": true,
    "agenda_configurada": true,
    "primeiro_agendamento_recebido": false
  },
  "proxima_acao_ativacao": {
    "estado": "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
    "concluido": false,
    "titulo": "Divulgue seu perfil",
    "mensagem": "Seu perfil está no ar e sua agenda está pronta. Compartilhe o link para conquistar o primeiro agendamento.",
    "acao": {
      "tipo": "COMPARTILHAR_PERFIL",
      "rotulo": "Compartilhar perfil"
    }
  }
}
```

Ações de navegação usam `tipo = NAVEGAR`, `rotulo` e `destino`. Divulgação usa `tipo = COMPARTILHAR_PERFIL` para reutilizar o mecanismo rastreável de compartilhamento já existente no AF.

## Medição da jornada

A interface registra observabilidade da recomendação com eventos de produto próprios:

- `proxima_acao_ativacao_visualizada`: a recomendação foi efetivamente apresentada no dashboard;
- `proxima_acao_ativacao_selecionada`: a profissional selecionou a ação principal recomendada.

Os eventos usam `dashboard_dono`, missão `gerenciar_crescimento` e apenas propriedades operacionais não sensíveis: `estado_ativacao` e `tipo_acao`.

No estado `CONQUISTAR_PRIMEIRO_AGENDAMENTO`, a seleção da recomendação e a conclusão do compartilhamento são fatos diferentes. A seleção registra intenção; `link_negocio_compartilhado` ou `link_negocio_copiado` continua registrando o resultado do mecanismo de share.

Nenhum desses eventos substitui os marcos canônicos do backend. Clique, visualização e compartilhamento são sinais de comportamento, não ativação. O resultado deve ser medido pela progressão real do negócio entre os sinais canônicos e, por fim, pelo primeiro agendamento não cancelado.

A análise recomendada é:

```text
recomendação visualizada
  -> ação selecionada
  -> marco canônico correspondente concluído
  -> próxima etapa de ativação
  -> primeiro agendamento não cancelado
```

Isso permite medir taxa de seleção e taxa de progressão por estado sem tratar clique como sucesso de produto.

## Ativação no administrativo

O administrativo usa a mesma definição de resultado da máquina de ativação. Em `/admin/saude`, a fila operacional possui cinco marcos: negócio criado, dados essenciais completos, serviço ativo, negócio publicado e primeiro agendamento não cancelado. Publicação, isoladamente, não encerra a ativação administrativa.

`Descrição` permanece uma melhoria opcional e não entra no denominador do progresso. Disponibilidade é diagnóstico técnico separado, com prioridade abaixo de reprocessar a publicação automática. Os bloqueios podem se sobrepor para diagnóstico, mas a próxima ação respeita a ordem canônica e só orienta divulgação para primeiro agendamento quando o negócio já está publicado.

Na priorização operacional, profissionais mais próximos de concluir vêm primeiro; em empate de progresso, quem está há mais tempo sem atividade vem antes. Essa regra deve ser aplicada no backend para que Visão geral e Ativação apresentem a mesma fila.

## Pós-ativação e retenção

`ATIVADO` permanece como estado canônico da máquina, mas deixa de competir visualmente com a próxima oportunidade de crescimento. No dashboard, a ativação concluída deve ser apresentada como marco secundário; quando houver uma oportunidade determinística de Growth, ela pode aparecer primeiro.

A recorrência usa somente dados agregados do negócio e exclui agendamentos cancelados. O resumo canônico expõe `clientes_unicos`, `clientes_recorrentes` e `taxa_recorrencia`. A identidade usada para deduplicação segue o padrão já adotado pelo dashboard: conta do cliente quando conhecida ou WhatsApp normalizado do agendamento visitante. Esses identificadores não são enviados à inteligência de crescimento.

A oportunidade `RECORRENCIA_BAIXA_COM_AMOSTRA` só pode ser avaliada após a amostra mínima definida no serviço de sinais. Ela é uma heurística de priorização, não uma inferência causal: a mensagem deve declarar que os dados não identificam a causa da recorrência observada.

## Limite entre regra e IA

Regras de publicação, serviço ativo, permissões, limites de plano, preços, pagamentos e disponibilidade continuam determinísticas e sob autoridade do backend.

Camadas de inteligência podem agregar valor quando houver interpretação de múltiplos sinais, linguagem natural ou personalização. Exemplos: explicar desempenho, comparar períodos ou sugerir hipóteses de melhoria usando métricas já calculadas e autorizadas pelo backend.

Essa inteligência não pode:

- decidir se um negócio pode ser publicado;
- alterar a ordem canônica das etapas de ativação;
- liberar horários inexistentes;
- alterar preços, limites, permissões ou regras financeiras;
- substituir validações do backend;
- tratar recomendação probabilística ou heurística como fato operacional.

A máquina de estados deve funcionar integralmente mesmo se qualquer integração de IA estiver indisponível.

## Escopo da máquina de ativação

A máquina de ativação não usa:

- LLM;
- OpenAI API;
- embeddings;
- banco vetorial;
- memória própria;
- tabela específica de IA;
- nova rota;
- nova migration.

Retenção, recorrência, otimização de conversão e recomendações baseadas em métricas não alteram esta máquina de estados. Depois de `ATIVADO`, a interface reduz o marco de ativação a um status secundário e pode priorizar oportunidades de crescimento determinísticas, incluindo recorrência quando houver amostra agregada suficiente.

## Proteção por testes

As transições devem permanecer protegidas em três níveis:

1. teste unitário da máquina de estados, incluindo estados normais, legados e regressões;
2. teste de integração do repository para serviço ativo, publicação, disponibilidade técnica e primeiro agendamento;
3. testes de frontend e jornada para confirmar que o dashboard apresenta o contrato do backend e mantém o compartilhamento rastreável.

A observabilidade também deve ser protegida por testes do contrato de eventos e por testes de interface que diferenciem visualização, seleção e conclusão do compartilhamento.

Mudanças futuras nessa ordem ou na definição de qualquer sinal canônico devem atualizar esta documentação e os testes correspondentes.
