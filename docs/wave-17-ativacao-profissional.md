# Wave 17 — Ativação profissional até o primeiro agendamento

> **Papel documental:** documento de evidência/workstream da Wave 17. Enquanto a wave estiver aberta, seu estado não substitui as regras canônicas de ativação; decisões duráveis devem ser refletidas nos documentos principais.

> Hardening da jornada de aquisição e ativação profissional após a proteção da
> experiência pública móvel concluída na Wave 16.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**. A Wave 17 não cria
> critérios retroativos; ela protege o funil real até o primeiro agendamento
> válido.

## Objetivo

A Wave 17 passa a proteger a transição:

```text
cadastro profissional
  → negócio criado
  → primeiro serviço ativo
  → publicação
  → horários
  → divulgar perfil rastreável
  → primeiro agendamento válido
  → ativação encerrada
```

O foco é garantir que o produto não confunda intenção com resultado:

- clicar em compartilhar não é ativação;
- copiar/compartilhar link não é primeiro agendamento;
- apenas o estado canônico retornado pelo backend após existir um agendamento
  não cancelado encerra a missão de ativação.

Isso reforça diretamente a etapa do funil entre **publicação** e **primeiro
agendamento**, uma das prioridades atuais do AF.

## Causa e risco observados

A implementação já possuía:

- máquina de estados determinística no backend;
- próxima ação canônica no dashboard;
- compartilhamento rastreável pelo AF;
- testes unitários de cada componente;
- E2E da criação profissional até o CTA `Compartilhar perfil`.

O ponto ainda não protegido por uma única jornada de navegador era a fronteira
entre o comportamento de divulgação e o resultado real de ativação.

Sem essa regressão integrada, seria possível uma mudança futura:

- perder os parâmetros próprios de atribuição do link;
- tratar compartilhamento como conclusão da ativação;
- manter o card de ativação depois do primeiro agendamento;
- continuar mostrando conversão de pré-ativação quando o negócio já entrou em
  pós-ativação;
- introduzir regressão mobile na transição do dashboard.

## Implementação da Wave

A regressão `professional-activation-flow.spec.js` passa a verificar, na mesma
jornada:

1. criação da conta profissional;
2. criação do negócio;
3. primeiro serviço ativo e publicação;
4. confirmação rápida dos horários;
5. chegada ao dashboard com missão `CONQUISTAR_PRIMEIRO_AGENDAMENTO`;
6. compartilhamento do perfil com fallback para cópia;
7. link contendo:
   - `af_source=agenda_fashion`;
   - `af_medium=share`;
   - `af_content=negocio`;
   - ausência de `utm_campaign` inventada;
8. manutenção da missão de ativação imediatamente após o compartilhamento;
9. transição para `ATIVADO` somente quando o backend passa a informar
   `primeiro_agendamento_recebido = true`;
10. remoção do painel `Próximo passo`;
11. troca do indicador de pré-ativação `Conversão` pelo indicador recorrente
    `Clientes que voltaram`;
12. ausência de overflow horizontal no estado pós-ativação.

As APIs do E2E permanecem mockadas. O teste não cria dados de produção.

## Impacto

### Produto e growth

A Wave protege o significado do funil:

```text
divulgação = comportamento/interesse
primeiro agendamento válido = ativação
```

Isso evita inflar ativação com cliques ou compartilhamentos e preserva a leitura
correta de aquisição → ativação → retenção.

### Frontend

Não há mudança de comportamento de produção neste primeiro patch. O objetivo é
congelar no navegador o comportamento já definido e reduzir risco de regressão
antes de novas otimizações de ativação.

### Backend e banco

Nenhum contrato, migration, autorização ou regra de booking foi alterado. O E2E
continua consumindo a decisão canônica recebida do backend em vez de recalcular
ativação no frontend.

### Analytics

Os parâmetros próprios do link AF permanecem distintos de UTM de campanha.
Compartilhamento continua sendo sinal comportamental; o primeiro agendamento
válido permanece o resultado de ativação.

### Segurança e privacidade

Nenhuma nova informação pessoal é coletada ou persistida. O teste usa dados
fictícios e APIs mockadas.

## Critério de encerramento da Wave 17

A Wave pode ser encerrada quando:

1. o Quality Gate estiver verde no head final;
2. o E2E profissional passar na matriz mobile suportada;
3. o link de divulgação permanecer rastreável pelo AF;
4. compartilhamento não encerrar ativação;
5. o estado `ATIVADO` remover a missão antiga e apresentar o contexto
   pós-ativação;
6. não houver alteração desnecessária em backend, banco ou integrações.

## Estado de encerramento

O patch de regressão e a documentação estão preparados na branch
`feat/product-ux-wave-17`.

A Wave é considerada encerrada somente quando o **head final** passar pelo
Quality Gate, o E2E profissional estiver verde na matriz mobile suportada, o
diff final não introduzir mudança fora do escopo e o PR for mergeado com
autorização explícita. Uma falha de teste deve ser corrigida pela causa raiz,
sem remover a proteção comportamental descrita neste documento.
