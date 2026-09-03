# Próxima ação de ativação do Agenda Fashion

## Objetivo

A próxima ação de ativação orienta a dona do negócio para o passo obrigatório mais importante até o primeiro agendamento registrado.

Ela existe para reduzir abandono entre criação do negócio, serviço ativo, agenda confirmada, publicação e primeiro agendamento. Essa camada é uma máquina de estados determinística: não é IA, não usa LLM e não deve ser apresentada ao usuário como inteligência artificial.

## Fonte de verdade

A decisão é feita no backend a partir do estado canônico do negócio:

- `possui_servico_ativo`: existe ao menos um registro ativo em `servicos_negocio` para o negócio;
- `agenda_configurada`: existe profissional ativo do negócio com `agenda_configuracoes.configurado_em` preenchido;
- `negocio_publicado`: `negocios.publicado = TRUE`;
- `primeiro_agendamento_recebido`: existe ao menos um agendamento registrado para o negócio, mesmo que ele seja cancelado posteriormente.

O frontend não deve recalcular a próxima etapa usando visitas ao perfil, métricas de conversão, pendências de publicação ou outras heurísticas.

## Ordem das transições

A prioridade oficial é:

1. `GARANTIR_SERVICO_ATIVO`
2. `CONFIRMAR_AGENDA`
3. `REVISAR_PUBLICACAO`
4. `CONQUISTAR_PRIMEIRO_AGENDAMENTO`
5. `ATIVADO`

A ordem é deliberada e também protege estados legados ou regressões operacionais. Um negócio que já recebeu agendamento, mas perdeu todos os serviços ativos, volta para `GARANTIR_SERVICO_ATIVO`. Um negócio publicado sem agenda confirmada, situação possível em compatibilidade legada, recebe `CONFIRMAR_AGENDA` antes de qualquer orientação de divulgação.

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

## Limite entre regra e IA

Regras de publicação, serviço ativo, agenda confirmada, permissões, limites de plano, preços, pagamentos e disponibilidade continuam determinísticas e sob autoridade do backend.

Uma futura camada de IA pode agregar valor quando houver interpretação de múltiplos sinais, linguagem natural ou personalização. Exemplos: explicar por que a conversão caiu, resumir desempenho, comparar períodos ou sugerir hipóteses de melhoria usando métricas já calculadas e autorizadas pelo backend.

Essa futura IA não pode:

- decidir se um negócio pode ser publicado;
- alterar a ordem canônica das etapas de ativação;
- liberar horários inexistentes;
- alterar preços, limites, permissões ou regras financeiras;
- substituir validações do backend;
- tratar recomendação probabilística como fato operacional.

A máquina de estados deve funcionar integralmente mesmo se qualquer integração futura de IA estiver indisponível.

## Escopo do V1

O V1 não usa:

- LLM;
- OpenAI API;
- embeddings;
- banco vetorial;
- memória própria;
- tabela específica de IA;
- nova rota;
- nova migration.

Retenção, recorrência, otimização de conversão e recomendações baseadas em métricas podem alimentar uma futura camada de inteligência, mas não devem alterar esta máquina de estados.

## Proteção por testes

As transições devem permanecer protegidas em três níveis:

1. teste unitário da máquina de estados, incluindo estados normais, legados e regressões;
2. teste de integração do repository para serviço ativo, publicação, agenda e primeiro agendamento;
3. testes de frontend e jornada para confirmar que o dashboard apresenta o contrato do backend e mantém o compartilhamento rastreável.

Mudanças futuras nessa ordem ou na definição de qualquer sinal canônico devem atualizar esta documentação e os testes correspondentes.
