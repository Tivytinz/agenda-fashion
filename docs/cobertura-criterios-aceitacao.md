# Cobertura dos critérios de aceitação

> Estado consolidado após a Wave 13 — 22/09/2026.
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

### Wave 13 — jornada pública e cliente

Fechou quatro cenários P1 ligados à conversão de agendamento:

- `CA-AG-04`: cliente autenticada reutiliza nome e WhatsApp persistidos, e o backend ignora identidade divergente enviada pelo navegador;
- `CA-NEG-06`: negócio previamente publicado continua acessível sem serviço ativo, sem permitir booking de serviço inativo;
- `CA-NEG-07`: perfil e serviço continuam visíveis sem slots, com estado vazio na UI e bloqueio de criação fora da disponibilidade;
- `CA-AG-21`: reagendamento que já fica fora do cutoff comunica à cliente que o cancelamento direto pelo AF está indisponível.

Com a Wave 13, a cobertura P1 passou para **4/7 (57,1%)** e a cobertura combinada
P0 + P1 passou para **64/67 (95,5%)**.

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

### Wave 14 — autenticação e privacidade

Fechou os dois cenários funcionais P1 restantes:

- `CA-AUT-04`: recuperação de senha validada ponta a ponta com token aleatório
  de uso único, hash persistido, rejeição de token inválido/reutilizado, troca
  efetiva da senha e novos links com o segredo no fragmento `#token=`;
- `CA-PRV-03`: negócio arquivado deixa explicitamente de contar como negócio
  próprio operacional e a mesma conta pode criar um novo negócio após o
  arquivamento seguro.

## Cobertura P1 atual

A baseline possui **7 cenários P1**. Seis estão concluídos:

| Critério | Tema | Estado |
| --- | --- | --- |
| `CA-AG-04` | Reutilizar dados do cliente autenticado | Concluído na Wave 13 |
| `CA-NEG-06` | Negócio publicado sem serviço ativo | Concluído na Wave 13 |
| `CA-NEG-07` | Negócio publicado sem disponibilidade | Concluído na Wave 13 |
| `CA-AG-21` | Reagendamento já sem cancelamento direto | Concluído na Wave 13 |
| `CA-AUT-04` | Recuperação de senha | Concluído na Wave 14 |
| `CA-PRV-03` | Negócio arquivado não conta no limite | Concluído na Wave 14 |
| `CA-NFR-05` | Metas de desempenho | Pendente de medição em ambiente representativo |

```text
Cobertura P1:       6/7  (85,7%)
Cobertura P0 + P1: 66/67 (98,5%)
```

## Próxima Wave proposta

A **Wave 15** deve tratar exclusivamente `CA-NFR-05`, porque o critério exige
evidência de performance em ambiente representativo:

- medir operações críticas de API e calcular p95;
- medir páginas públicas críticas no perfil móvel/rede de referência e observar
  LCP;
- comparar com as metas da baseline: API p95 ≤ 2 s e LCP mobile ≤ 2,5 s;
- corrigir gargalos somente quando a medição apontar uma causa real;
- repetir a medição depois de qualquer otimização relevante.

Performance não deve ser marcada como concluída apenas por inspeção de código ou
por um teste sintético sem condições representativas.

## Regra de atualização

Atualizar este documento quando uma Wave alterar a cobertura da baseline ou
quando uma evidência operacional pendente mudar de estado.

Não usar este arquivo para substituir regras de produto permanentes. Decisões
duráveis de arquitetura, segurança, produto e operação permanecem nos documentos
especializados e, quando autorizado, no `AGENTS.md`.
