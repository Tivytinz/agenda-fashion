# Roadmap de infraestrutura futura

## Objetivo

Registrar melhorias de infraestrutura que são importantes para confiabilidade e segurança do Agenda Fashion, mas que **não são prioridade imediata na fase atual de aquisição e validação**.

A decisão atual é priorizar produto, aquisição, ativação, primeiro agendamento, retenção e monetização. As melhorias abaixo devem ser retomadas quando o AF começar a escalar tráfego pago e o impacto potencial de indisponibilidade ou perda de dados crescer de forma relevante.

## Gatilho para reavaliar

Reavaliar este roadmap quando ocorrer um ou mais dos seguintes cenários:

- tráfego pago deixar a fase de teste e passar a operar de forma contínua ou com aumento relevante de orçamento;
- o volume de profissionais, negócios, clientes ou agendamentos ativos crescer de forma material;
- o AF começar a acumular receita recorrente suficiente para tornar perda de dados ou indisponibilidade um risco financeiro relevante;
- perder até 24 horas de dados deixar de ser aceitável para a operação;
- antes de uma expansão importante de aquisição, campanha ou investimento de mídia.

Não usar apenas cliques, impressões, CTR, CPC ou volume bruto de cadastros como gatilho. A decisão deve considerar crescimento real de negócios ativos, primeiro agendamento, recorrência, assinaturas e receita.

## Melhorias futuras

### 1. Wait for CI no Railway

Objetivo: impedir que um deploy de produção comece antes de o Quality Gate do GitHub concluir com sucesso.

Estado desejado:

- Railway conectado à `main`;
- `Wait for CI` / `checkSuites` habilitado;
- deploy iniciado somente após os checks obrigatórios passarem.

Essa melhoria é simples, mas pode ser ativada junto com a próxima revisão operacional de produção para evitar mudanças de infraestrutura desnecessárias durante a fase atual.

### 2. Backup automático do PostgreSQL

Objetivo: garantir recuperação de dados em caso de erro humano, migration defeituosa, exclusão acidental, corrupção ou falha operacional.

Implementação mínima recomendada para a próxima fase:

- backup lógico automático com `pg_dump`;
- execução diária;
- armazenamento privado fora do volume principal do PostgreSQL;
- retenção inicial de 7 a 14 dias;
- monitoramento de falhas do job;
- teste real de restauração antes de considerar o backup operacional.

Um backup só deve ser considerado confiável depois que uma restauração em ambiente isolado tiver sido testada com sucesso.

### 3. Backups nativos / PITR

Quando o volume de dados e a receita justificarem maior proteção, avaliar:

- snapshots nativos do provedor;
- Point-in-Time Recovery (PITR);
- definição formal de RPO e RTO;
- política de retenção diária, semanal e mensal;
- procedimento documentado de disaster recovery.

PITR não é requisito imediato para a fase atual.

### 4. Alta disponibilidade e redundância

Não priorizar agora:

- múltiplas réplicas do app apenas por redundância;
- PostgreSQL em alta disponibilidade;
- múltiplas regiões;
- failover automatizado complexo.

Essas medidas devem ser avaliadas apenas quando o custo de indisponibilidade justificar a complexidade operacional adicional.

## Baseline já adotado

O AF já possui endpoint de readiness `/health/ready`, que valida PostgreSQL e migrations antes de considerar a aplicação pronta. O Railway está configurado para usar esse endpoint como healthcheck de produção.

## Princípio de decisão

A infraestrutura deve crescer junto com o risco real do produto.

Não antecipar complexidade apenas porque ela é tecnicamente possível. Priorizar primeiro aquisição de profissionais qualificados, ativação, primeiro agendamento, recorrência, retenção e monetização; endurecer a infraestrutura conforme o tráfego pago, o uso e a receita tornarem esses riscos materialmente relevantes.
