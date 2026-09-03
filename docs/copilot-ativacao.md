# Copilot de Ativação do Agenda Fashion

## Objetivo

O Copilot de Ativação orienta a dona do negócio para o próximo passo necessário até o primeiro agendamento real.

Ele existe para reduzir abandono entre criação do negócio, serviço ativo, agenda confirmada, publicação e primeiro agendamento. O Copilot não substitui as regras de publicação nem cria uma segunda fonte de verdade para o funil.

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

`GET /dashboard-dono` continua expondo `ativacao` e acrescenta `copilot_ativacao`.

Exemplo:

```json
{
  "ativacao": {
    "possui_servico_ativo": true,
    "negocio_publicado": true,
    "agenda_configurada": true,
    "primeiro_agendamento_recebido": false
  },
  "copilot_ativacao": {
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

## Escopo do V1

O V1 é determinístico e não usa:

- LLM;
- OpenAI API;
- embeddings;
- banco vetorial;
- memória própria;
- tabela específica de Copilot;
- nova rota;
- nova migration.

Retenção, recorrência, otimização de conversão e recomendações baseadas em métricas pertencem a uma futura camada de Copilot de Crescimento. Elas não devem alterar a máquina de estados da ativação.

## Proteção por testes

As transições devem permanecer protegidas em três níveis:

1. teste unitário da máquina de estados, incluindo estados normais, legados e regressões;
2. teste de integração do repository para serviço ativo, publicação, agenda e primeiro agendamento;
3. testes de frontend e jornada para confirmar que o dashboard apresenta o contrato do backend e mantém o compartilhamento rastreável.

Mudanças futuras nessa ordem ou na definição de qualquer sinal canônico devem atualizar esta documentação e os testes correspondentes.
