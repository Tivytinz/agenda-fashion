# Base de conhecimento do Agenda Fashion

> Documentacao duravel do produto e da operacao. Revisada contra a `main` em 26 de agosto de 2026.

O `AGENTS.md` na raiz continua sendo a memoria operacional central do Agenda Fashion. Esta pasta detalha os assuntos por dominio para evitar que uma unica memoria concentre produto, arquitetura, growth, seguranca e operacao inteira.

## Fonte de verdade

Antes de afirmar que uma funcionalidade, integracao, regra, evento ou limite existe no AF, use esta ordem:

1. codigo executavel e migrations;
2. testes automatizados;
3. configuracoes e contratos versionados;
4. documentacao tecnica desta pasta;
5. `AGENTS.md` como direcao, regras e contexto operacional.

Uma migration antiga pode representar somente uma etapa historica. Quando migrations posteriores ou o codigo atual alterarem a regra, a documentacao deve refletir o estado final. Exemplo atual: a migration `043_publicacao_automatica_perfil_servico.sql` exigia descricao no backfill, mas `047_publicacao_sem_descricao_obrigatoria.sql` e `servicosRepository.sincronizarPublicacaoAutomatica` confirmam que descricao nao e requisito atual de publicacao.

## Mapa dos documentos

| Documento | Responsabilidade |
| --- | --- |
| `produto.md` | entidades, proposta de valor, marketplace, publicacao e jornadas principais |
| `arquitetura.md` | stack, camadas, contratos, infraestrutura e arquitetura atual |
| `planos.md` | planos oficiais, limites, upgrade e regras de capacidade |
| `growth.md` | fase atual, funil, aquisicao, ativacao, monetizacao e retencao |
| `analytics.md` | eventos, atribuicao, KPIs, consentimento e qualidade dos dados |
| `pagamentos.md` | visao de dominio de pagamentos e ligacao com a documentacao tecnica do Asaas |
| `checkout-idempotente.md` | comportamento tecnico do checkout idempotente |
| `webhook-asaas.md` | autenticacao, deduplicacao e processamento dos webhooks do Asaas |
| `whatsapp-automatico.md` | fila, consentimento, templates, entrega e automacoes de WhatsApp |
| `whatsapp.env.example` | referencia de configuracao do WhatsApp sem segredos reais |
| `seguranca.md` | autenticacao, autorizacao, privacidade e protecoes verificadas |
| `ux.md` | identidade, descoberta, mobile, estados e principios de interface |
| `operacao.md` | CI/CD, deploy, migrations, healthchecks, workers e incidentes |
| `meta-ads-real-campaign-link.md` | anotacao tecnica especifica de vinculacao de campanha Meta Ads |

## Como registrar estado

Use tres categorias quando necessario:

- **Implementado**: existe no codigo/migration/teste atual.
- **Regra de produto**: decisao aprovada que deve orientar mudancas, mesmo quando nao for uma funcionalidade isolada.
- **Lacuna conhecida**: comportamento desejado que ainda nao deve ser apresentado como implementado.

Nao transforme resultado temporario de campanha, metricas de um dia, incidentes pontuais ou numeros do painel em memoria permanente. Esses dados devem ser consultados na fonte atual quando forem necessarios.

## Atualizacao

Toda mudanca relevante deve atualizar o documento correspondente no mesmo conjunto de alteracoes. Nao reescreva migrations aplicadas para fazer a documentacao parecer correta. Corrija a documentacao ou crie uma migration nova quando o produto realmente precisar mudar.