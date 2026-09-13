# Profissionais e negócios

> Regra de produto e invariantes de vínculo entre contas, profissionais e negócios do Agenda Fashion.
>
> Atualizada em setembro de 2026.

Este documento consolida a regra de negócio para vínculos de profissionais com negócios. Em caso de divergência, o código executável e as migrations representam o estado implementado; este documento registra a direção canônica de produto e as invariantes que a implementação deve alcançar.

## 1. Regra canônica

Uma mesma pessoa deve possuir uma única identidade no Agenda Fashion e pode manter vínculo ativo com um ou mais negócios.

A relação conceitual entre `usuarios` e `negocios` é muitos-para-muitos (N:N), materializada por `usuarios_negocios`.

Exemplo:

```text
Ana (`usuarios`)
  ├── profissional no Salão Bella
  ├── profissional no Studio Rosa
  └── dona do Espaço Ana
```

Não criar contas duplicadas para representar a mesma pessoa trabalhando em locais diferentes.

## 2. Identidade e contexto do vínculo

`usuarios` representa a identidade global da pessoa.

`usuarios_negocios` representa o papel e o contexto daquela pessoa dentro de um negócio específico.

Regras duráveis:

- cada par `(usuario_id, negocio_id)` deve possuir no máximo um vínculo;
- o papel pertence ao vínculo, não à identidade global;
- os papéis atuais são `dono` e `profissional`;
- a mesma conta pode exercer papéis diferentes em negócios diferentes;
- desativar um vínculo não exclui a conta da pessoa nem os demais vínculos;
- histórico de agendamentos, auditoria e referências persistentes não deve ser apagado ao encerrar um vínculo.

## 3. Perfil por negócio

Informações que descrevem como a profissional aparece dentro de um negócio podem variar por vínculo.

O schema atual já possui em `usuarios_negocios`:

- `nome_exibicao`;
- `whatsapp_exibicao`.

Esses campos não alteram a identidade global de `usuarios`.

A evolução do produto deve continuar separando dados globais da pessoa de dados contextuais do vínculo sempre que essa distinção representar a realidade do negócio.

## 4. Limites de plano

O limite de profissionais é capacidade do negócio, não da conta global.

Se a mesma pessoa estiver vinculada ativamente a dois negócios, ela consome uma posição de profissional em cada negócio para fins de capacidade, conforme as regras do plano de cada unidade.

Exemplo:

```text
Salão A — plano permite 5 profissionais
Ana ocupa 1 posição

Salão B — plano permite 1 profissional
Ana ocupa 1 posição
```

Limites de plano devem continuar validados no backend e dentro da operação que cria ou reativa o vínculo quando a atomicidade for necessária.

## 5. Serviços

Serviços pertencem ao negócio.

O fato de uma pessoa estar vinculada a vários negócios não transfere automaticamente serviços, preços ou condições de um negócio para outro.

A elegibilidade de uma profissional para executar um serviço deve ser resolvida dentro do contexto do negócio correspondente e não presumida apenas pela identidade global da usuária.

## 6. Disponibilidade e agenda

A regra de produto para múltiplos vínculos precisa separar dois conceitos:

1. **disponibilidade oferecida no negócio** — quando aquela profissional atende naquela unidade;
2. **ocupação global da pessoa** — horários em que ela já está comprometida, independentemente de qual negócio originou o compromisso.

Assim, uma profissional pode oferecer horários diferentes em negócios diferentes, mas não pode ser reservada simultaneamente em dois locais.

Exemplo:

```text
Ana
  Salão A → segunda, quarta e sexta
  Salão B → terça e quinta
```

Se existir um agendamento para Ana das 14:00 às 15:00 em qualquer negócio, outro negócio não pode confirmar um agendamento sobreposto para a mesma pessoa nesse intervalo.

A disponibilidade final de um slot deve resultar da combinação entre:

- vínculo ativo e elegível no negócio;
- disponibilidade configurada para aquele contexto;
- regras do serviço e do negócio;
- bloqueios aplicáveis;
- ausência de agendamento conflitante da mesma pessoa em qualquer negócio.

## 7. Proteção contra double booking

A identidade usada para detectar conflito deve continuar representando a pessoa real, e não apenas o negócio em que ela está atendendo.

Portanto, a validação de concorrência deve impedir sobreposição para o mesmo `usuario_id` profissional mesmo quando os agendamentos pertençam a `negocio_id` diferentes.

A regra vale para todo o intervalo do agendamento, e não apenas para horários iniciais idênticos.

Exemplo inválido:

```text
Salão A
Ana → 14:00–15:00

Studio B
Ana → 14:30–15:30  ❌
```

Exemplo válido:

```text
Salão A
Ana → 14:00–15:00

Studio B
Ana → 15:00–16:00  ✅
```

## 8. Remoção e desativação de vínculo

Ao remover uma profissional de um negócio:

- o vínculo deve ser desativado ou encerrado conforme o fluxo implementado;
- a conta global da pessoa deve permanecer;
- outros vínculos ativos devem permanecer intactos;
- dados históricos do negócio não devem ser transferidos para outro negócio;
- agendamentos históricos devem continuar associados ao negócio em que ocorreram;
- novas operações privadas daquele negócio devem ser bloqueadas imediatamente após a perda do vínculo.

Reativação deve respeitar capacidade do plano, autorização e demais invariantes vigentes.

## 9. Multi-tenancy e autorização

Múltiplos vínculos não reduzem o isolamento entre negócios.

O backend deve validar, em cada operação privada relevante:

- usuário autenticado;
- vínculo ativo com o negócio;
- papel/permissão necessários;
- pertencimento dos recursos ao mesmo negócio.

`negocio_id`, papel, permissão ou qualquer outro identificador enviado pelo frontend não é prova de autorização.

Uma profissional vinculada ao Negócio A e ao Negócio B pode acessar apenas os dados permitidos em cada contexto. O vínculo com A nunca autoriza acesso a dados privados de B por si só.

## 10. Estado atual da implementação

Existe hoje uma divergência conhecida entre a direção de produto registrada em `AGENTS.md` e partes do schema legado.

### 10.1 Vínculo profissional ativo

A migration `003_usuarios_negocios.sql` criou o índice parcial:

```text
usuarios_negocios_profissional_ativo_unique
```

Esse índice limita uma conta com papel `profissional` a apenas um negócio ativo por vez.

Isso conflita com a regra canônica deste documento e com a definição atual de profissional em `AGENTS.md`, que permite vínculo com um ou mais negócios.

A migration já aplicada não deve ser reescrita. Para habilitar múltiplos vínculos ativos de fato, uma nova migration deverá remover ou substituir essa restrição de forma segura.

### 10.2 Disponibilidade recorrente

A migration `005_agenda_configuracoes.sql` modela `agenda_configuracoes` e `agenda_horarios` apenas por `profissional_id`, sem `negocio_id`.

Esse modelo representa uma agenda recorrente global por pessoa e não consegue expressar, sozinho, horários distintos por negócio.

Antes de considerar o suporte multi-negócio completo, a modelagem de disponibilidade deve ser evoluída para representar o contexto do negócio sem perder a proteção global contra conflitos.

### 10.3 Agendamentos e conflito global

A migration `006_fluxo_agendamentos.sql` registra `agendamentos.profissional_id` como referência a `usuarios(id)` e cria proteção por profissional, data e horário.

Essa escolha fornece uma boa base para impedir double booking entre negócios porque a identidade do profissional é global.

O documento `docs/agendamento-integridade.md` também estabelece serialização por `(profissional_id, data)` e validação do intervalo completo.

### 10.4 Perfil contextual

A migration `026_perfil_profissional_por_negocio.sql` já introduziu `nome_exibicao` e `whatsapp_exibicao` no vínculo, alinhando parte do schema ao modelo contextual por negócio.

## 11. Critérios de aceite para suporte multi-negócio

O suporte deve ser considerado completo apenas quando houver cobertura automatizada para, no mínimo:

- uma mesma conta possuir vínculos profissionais ativos em dois negócios;
- impedir vínculo duplicado do mesmo par `(usuario_id, negocio_id)`;
- preservar papéis e autorizações independentes por negócio;
- aplicar limite de profissionais separadamente em cada negócio;
- permitir disponibilidade recorrente diferente por negócio;
- impedir agendamentos sobrepostos da mesma pessoa entre negócios diferentes;
- permitir agendamentos não sobrepostos em negócios diferentes;
- remover vínculo de um negócio sem afetar outros vínculos da conta;
- preservar histórico após desativação do vínculo;
- impedir acesso cruzado entre tenants;
- suportar concorrência real no PostgreSQL sem confirmar dois agendamentos conflitantes.

## 12. Referências

- `AGENTS.md` — entidades, contextos, segurança e prioridades de produto;
- `docs/arquitetura.md` — identidade, autorização e arquitetura técnica;
- `docs/planos.md` — limites de profissionais por negócio;
- `docs/agendamento-integridade.md` — integridade, locks e conflito de agenda;
- `database/migrations/003_usuarios_negocios.sql` — vínculo e restrições legadas;
- `database/migrations/005_agenda_configuracoes.sql` — disponibilidade atual;
- `database/migrations/006_fluxo_agendamentos.sql` — identidade do profissional nos agendamentos;
- `database/migrations/026_perfil_profissional_por_negocio.sql` — perfil contextual por negócio.
