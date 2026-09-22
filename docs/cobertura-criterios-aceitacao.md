# Cobertura dos critérios de aceitação

> Estado consolidado após a Wave 12 — 22/09/2026.
>
> Este documento registra rastreabilidade de implementação e não substitui a
> baseline funcional nem a matriz oficial de testes. Código executável,
> migrations e testes continuam sendo a evidência técnica do estado real.

## Estado P0

A baseline possui **60 cenários P0**. Após as Waves de cobertura concluídas,
todos os 60 possuem automação, evidência técnica compatível com o critério ou,
quando o próprio critério prevê essa saída, decisão formal de engenharia.

```text
Cobertura P0 da baseline: 60/60 (100%)
```

Essa porcentagem não significa que toda condição operacional externa já foi
comprovada em produção.

### Ressalva operacional de backup e recuperação

O `CA-NFR-07` permite como saída uma decisão formal de engenharia quando a
infraestrutura ainda não demonstra as metas exigidas. O AF adotou essa saída:

- a meta continua sendo RPO ≤ 1 hora e RTO ≤ 4 horas;
- o repositório possui runbook e condição de saída em
  `docs/backup-recovery.md`;
- a conformidade operacional com RPO/RTO **não deve ser declarada** enquanto
  não houver evidência de backup/PITR recorrente e restore test controlado com
  medição real.

Portanto, o P0 está coberto segundo o contrato da baseline, mas a evidência
operacional de recuperação continua pendente.

## Fechamentos recentes

### Wave 10 — identidade e autenticação profissional

Fechou os cenários P0 de identidade profissional na mesma conta:

- ativação do perfil profissional sem usuário duplicado;
- preservação de Client e histórico da identidade existente;
- ativação transacional em cadastro com intenção profissional, criação de
  negócio próprio e aceite válido de convite.

### Wave 11 — Analytics

Fechou os eventos críticos de booking no backend:

- `booking_created`;
- `booking_rescheduled`;
- `booking_cancelled`;
- `booking_completed`;
- `booking_no_show`.

Esses eventos são fatos de domínio persistidos em `analytics_eventos`, com
identificadores e ator derivados do estado persistido e dentro da mesma
transação lógica da mutação crítica.

### Wave 12 — não funcionais P0

Consolidou:

- retry/idempotência dos fluxos cobertos;
- instante canônico de agendamento em UTC/`TIMESTAMPTZ`;
- snapshot de fuso IANA por booking;
- conflito global de agenda entre contextos em fusos diferentes;
- cobertura de acessibilidade dos fluxos críticos;
- contrato do Quality Gate;
- runbook e decisão formal de backup/recuperação.

## Tempo e fuso horário

Para agendamentos:

- `agendamentos.inicio_previsto_em` representa **quando** o compromisso ocorre
  em instante absoluto;
- `agendamentos.fuso_horario_snapshot` registra **qual regra local IANA** foi
  usada, por exemplo `America/Sao_Paulo` ou `America/Manaus`;
- conflitos globais são comparados pelo instante absoluto;
- apresentação e geração de slots convertem o instante para o fuso IANA do
  contexto consultado;
- alterar o fuso cadastrado do negócio posteriormente não reinterpreta bookings
  históricos.

A advisory lock de agenda é global por profissional, evitando que duas
transações em datas locais/fusos diferentes confirmem intervalos absolutos
incompatíveis.

## Fila P1 atual

A baseline mantém **7 cenários P1** para cobertura explícita:

| Critério | Tema | Estado para próxima cobertura |
| --- | --- | --- |
| `CA-AUT-04` | Recuperação de senha | Fluxo existe; falta fechar a rastreabilidade P1 ponta a ponta |
| `CA-NEG-06` | Negócio publicado sem serviço ativo | Consolidar contrato público + bloqueio de novo booking |
| `CA-NEG-07` | Negócio publicado sem disponibilidade | Consolidar estado vazio e impedimento de criação |
| `CA-AG-04` | Reutilizar dados do cliente autenticado | Backend deve ser fonte da identidade; evitar pedir novamente os mesmos dados |
| `CA-AG-21` | Reagendamento já sem cancelamento direto | Levar o aviso também à comunicação enviada ao cliente |
| `CA-PRV-03` | Negócio arquivado não conta no limite | Fechar cenário explícito de criação após arquivamento |
| `CA-NFR-05` | Metas de desempenho | Medir API p95 e LCP em ambiente representativo |

## Próxima Wave proposta

A **Wave 13** deve priorizar jornada do cliente e estados públicos:

1. `CA-AG-04`;
2. `CA-NEG-06`;
3. `CA-NEG-07`;
4. `CA-AG-21`.

Esse agrupamento reduz fricção no agendamento e fecha estados em que o cliente
poderia receber formulário redundante, perfil sem oferta ou disponibilidade sem
uma resposta operacional clara.

A proposta acima é planejamento. Um critério só muda para concluído depois de
investigação no estado atual do repositório, implementação proporcional ao
risco, testes e Quality Gate verde.

## Regra de atualização

Atualizar este documento quando uma Wave alterar a cobertura da baseline ou
quando uma evidência operacional pendente mudar de estado.

Não usar este arquivo para substituir regras de produto permanentes. Decisões
duráveis de arquitetura, segurança, produto e operação permanecem nos documentos
especializados e, quando autorizado, no `AGENTS.md`.
