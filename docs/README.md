# Mapa de conhecimento do Agenda Fashion

Este diretório concentra a documentação especializada do Agenda Fashion (AF).
O objetivo deste índice é reduzir duplicação, deixar explícita a fonte canônica
de cada domínio e facilitar a navegação para desenvolvimento, produto, operação
e growth.

## Fonte de verdade

A ordem de precedência continua sendo:

1. código executável e migrations representam o estado implementado;
2. testes representam os comportamentos esperados;
3. `AGENTS.md` e `docs/` representam decisões, regras e intenção do produto.

Este índice organiza a documentação, mas não substitui essa hierarquia.

## Tipos de documento

- **Canônico**: concentra a regra durável ou visão principal de um domínio.
- **Especializado**: aprofunda um subconjunto do domínio canônico.
- **Runbook**: descreve procedimento operacional, validação ou recuperação.
- **Evidência/histórico**: registra cobertura, wave, campanha ou fechamento de
  uma etapa; não deve substituir uma regra canônica atual.

Quando dois documentos parecerem divergir, primeiro conferir código, migrations
e testes. Se a divergência documental for real, ela deve ser corrigida em vez de
ser mantida como duas interpretações válidas.

## Mapa rápido por domínio

| Domínio | Documento principal | Complementos |
| --- | --- | --- |
| Arquitetura | [arquitetura.md](./arquitetura.md) | [contexto-negocio.md](./contexto-negocio.md), [qualidade-codigo.md](./qualidade-codigo.md) |
| Ativação profissional | [ativacao-profissional-ux.md](./ativacao-profissional-ux.md) | [ativacao-proxima-acao.md](./ativacao-proxima-acao.md), [convites-profissionais.md](./convites-profissionais.md) |
| Agendamentos | [ciclo-atendimento.md](./ciclo-atendimento.md) | [agendamento-integridade.md](./agendamento-integridade.md), [confiabilidade-compromissos-agenda.md](./confiabilidade-compromissos-agenda.md), [snapshots-historicos-agendamento.md](./snapshots-historicos-agendamento.md), [cancelamento-agendamento-visitante.md](./cancelamento-agendamento-visitante.md) |
| Planos e monetização | [planos.md](./planos.md) | [checkout-idempotente.md](./checkout-idempotente.md), [asaas-ativacao-recorrencia.md](./asaas-ativacao-recorrencia.md) |
| Webhooks financeiros | [webhook-processing.md](./webhook-processing.md) | [webhook-asaas.md](./webhook-asaas.md), [webhook-retention.md](./webhook-retention.md) |
| Frontend e UX | [ux-contextos-visuais.md](./ux-contextos-visuais.md) | [frontend-estilos.md](./frontend-estilos.md), [public-shell.md](./public-shell.md), [experiencia-conversao-retencao.md](./experiencia-conversao-retencao.md) |
| Admin | [admin-console.md](./admin-console.md) | [admin-requisitos-matriz.md](./admin-requisitos-matriz.md), [admin-centro-comando.md](./admin-centro-comando.md), [admin-visao-geral.md](./admin-visao-geral.md), [admin-marketing-visao-geral.md](./admin-marketing-visao-geral.md) |
| Analytics e growth | [marketing-attribution.md](./marketing-attribution.md) | [analytics-pipeline-reconciliation.md](./analytics-pipeline-reconciliation.md), [inteligencia-crescimento.md](./inteligencia-crescimento.md), [custo-qualidade-aquisicao-profissional.md](./custo-qualidade-aquisicao-profissional.md), [prontidao-financeira-recorrencia.md](./prontidao-financeira-recorrencia.md), [marketing-sync-ga4.md](./marketing-sync-ga4.md) |
| Mídia paga | [google-ads-real-campaign-link.md](./google-ads-real-campaign-link.md) | [meta-ads-real-campaign-link.md](./meta-ads-real-campaign-link.md), [marketing-tiktok-ads.md](./marketing-tiktok-ads.md), [marketing-pinterest-ads.md](./marketing-pinterest-ads.md) |
| WhatsApp | [whatsapp-automatico.md](./whatsapp-automatico.md) | [whatsapp.env.example](./whatsapp.env.example) |
| IA e ML | [copilot-v1.md](./copilot-v1.md) | [arquitetura-copilot.md](./arquitetura-copilot.md), [machine-learning-no-show.md](./machine-learning-no-show.md) |
| Segurança e privacidade | [session-security.md](./session-security.md) | [dependency-security.md](./dependency-security.md), [encerramento-privacidade.md](./encerramento-privacidade.md) |
| Deploy e continuidade | [deploy-seguro.md](./deploy-seguro.md) | [backup-recovery.md](./backup-recovery.md), [performance-qa.md](./performance-qa.md) |
| Conteúdo | [estrategia-conteudo.md](./estrategia-conteudo.md) | [runway-criativos.md](./runway-criativos.md) |

## Arquitetura e engenharia

### Canônico

- [arquitetura.md](./arquitetura.md): arquitetura oficial do AF, stack,
  camadas backend, estrutura do repositório, frontend, identidade, agendamento,
  pagamentos, integrações, banco, testes e evolução arquitetural.

### Especializados e runbooks

- [contexto-negocio.md](./contexto-negocio.md): resolução e autorização do
  contexto de negócio.
- [qualidade-codigo.md](./qualidade-codigo.md): guardrails de qualidade do
  frontend, ESLint, código morto e CI.
- [dependency-security.md](./dependency-security.md): segurança de dependências.
- [performance-qa.md](./performance-qa.md): validação de performance.
- [deploy-seguro.md](./deploy-seguro.md): fluxo operacional de release.
- [backup-recovery.md](./backup-recovery.md): continuidade, backup, RPO/RTO e
  recuperação.

## Produto, ativação e equipe

### Canônico

- [ativacao-profissional-ux.md](./ativacao-profissional-ux.md): jornada de
  ativação da profissional e do negócio.
- [planos.md](./planos.md): catálogo, limites, downgrade e princípios de
  monetização.

### Especializados

- [ativacao-proxima-acao.md](./ativacao-proxima-acao.md): lógica de próxima ação
  na ativação.
- [convites-profissionais.md](./convites-profissionais.md): entrada e ativação de
  profissionais na equipe.
- [experiencia-conversao-retencao.md](./experiencia-conversao-retencao.md):
  experiência relacionada a conversão e retenção.

## Agendamentos

### Canônico

- [ciclo-atendimento.md](./ciclo-atendimento.md): lifecycle persistido,
  estados, transições, cancelamento, autorização, regra temporal e auditoria.

### Especializados

- [agendamento-integridade.md](./agendamento-integridade.md): invariantes de
  integridade.
- [confiabilidade-compromissos-agenda.md](./confiabilidade-compromissos-agenda.md):
  confiabilidade operacional da agenda.
- [snapshots-historicos-agendamento.md](./snapshots-historicos-agendamento.md):
  preservação de regras históricas do booking.
- [cancelamento-agendamento-visitante.md](./cancelamento-agendamento-visitante.md):
  capability e cancelamento de visitante.

Regra de manutenção: a definição de estado e transição pertence ao documento de
ciclo. Documentos especializados devem aprofundar garantias específicas sem
redefinir o lifecycle inteiro.

## Financeiro e Asaas

### Canônico de produto

- [planos.md](./planos.md): entitlement, limites, upgrade/downgrade e relação do
  produto com a assinatura.

### Especializados técnicos

- [checkout-idempotente.md](./checkout-idempotente.md): criação segura do
  checkout.
- [asaas-ativacao-recorrencia.md](./asaas-ativacao-recorrencia.md): ativação e
  recorrência financeira.
- [webhook-processing.md](./webhook-processing.md): processamento de eventos
  financeiros.
- [webhook-asaas.md](./webhook-asaas.md): integração específica com o Asaas.
- [webhook-retention.md](./webhook-retention.md): retenção dos eventos.

Regra de manutenção: checkout iniciado, cobrança criada, pagamento confirmado e
assinatura ativa permanecem fatos distintos. Leituras de campanha que relacionam
investimento e monetização pertencem ao domínio de Analytics/Growth, não ao
contrato de billing.

## Frontend e UX

### Canônico de contexto visual

- [ux-contextos-visuais.md](./ux-contextos-visuais.md): diferenças entre
  contextos público, dona, profissional e admin.

### Especializados

- [frontend-estilos.md](./frontend-estilos.md): ownership de estilos, design
  systems e manutenção de CSS.
- [public-shell.md](./public-shell.md): shell da experiência pública.

## Administração

### Canônico

- [admin-console.md](./admin-console.md): arquitetura de informação, navegação e
  separação entre aquisição, jornada, retenção, receita e operação.

### Especializados

- [admin-requisitos-matriz.md](./admin-requisitos-matriz.md): baseline exclusiva
  de requisitos administrativos, evidências, lacunas e percentual próprio de
  cobertura do Admin.
- [admin-wave-1-rf40-operacao.md](./admin-wave-1-rf40-operacao.md):
  primeira Wave exclusiva do Admin; fecha a consulta/diagnóstico operacional
  v1 de RF40 para usuários, negócios, agendamentos e estados canônicos.
- [admin-wave-2-rf41-auditoria.md](./admin-wave-2-rf41-auditoria.md):
  contrato transversal de auditoria, limites de cobertura e critérios de
  validação da segunda Wave do Admin.
- [admin-wave-3-rf41-reconciliacao.md](./admin-wave-3-rf41-reconciliacao.md):
  revisão imutável das tentativas pendentes e medição de desempenho do Admin.
- [admin-centro-comando.md](./admin-centro-comando.md): semântica dos
  indicadores do centro de comando.
- [admin-visao-geral.md](./admin-visao-geral.md): KPIs agregados da rota
  `/admin`.
- [admin-marketing-visao-geral.md](./admin-marketing-visao-geral.md): leitura
  administrativa de aquisição e Marketing.

## Analytics, aquisição e growth

### Canônico de atribuição

- [marketing-attribution.md](./marketing-attribution.md): integridade da
  evidência, canonicalização e ligação do funil com origem e resultado.

### Especializados

- [analytics-pipeline-reconciliation.md](./analytics-pipeline-reconciliation.md):
  convivência e reconciliação de pipelines.
- [marketing-sync-ga4.md](./marketing-sync-ga4.md): sincronização com GA4.
- [inteligencia-crescimento.md](./inteligencia-crescimento.md): inteligência de
  crescimento.
- [custo-qualidade-aquisicao-profissional.md](./custo-qualidade-aquisicao-profissional.md):
  custo versus qualidade da aquisição.
- [prontidao-financeira-recorrencia.md](./prontidao-financeira-recorrencia.md):
  alinhamento descritivo entre investimento, recorrência e monetização em uma
  mesma base madura de campanha.
- [google-ads-real-campaign-link.md](./google-ads-real-campaign-link.md):
  vínculo operacional do Google Ads.
- [meta-ads-real-campaign-link.md](./meta-ads-real-campaign-link.md): vínculo
  operacional da Meta.
- [marketing-tiktok-ads.md](./marketing-tiktok-ads.md): integração TikTok Ads.
- [marketing-pinterest-ads.md](./marketing-pinterest-ads.md): integração
  Pinterest Ads.

## Comunicação, conteúdo e automação

- [whatsapp-automatico.md](./whatsapp-automatico.md): **canônico** para
  automações de WhatsApp, fila, consentimento e operação.
- [whatsapp.env.example](./whatsapp.env.example): exemplo de configuração, nunca
  fonte de segredo real.
- [estrategia-conteudo.md](./estrategia-conteudo.md): **canônico** para estratégia
  editorial.
- [runway-criativos.md](./runway-criativos.md): produção de criativos com IA e
  uso de créditos.

## IA, Copilot e Machine Learning

- [copilot-v1.md](./copilot-v1.md): contrato funcional do Copilot.
- [arquitetura-copilot.md](./arquitetura-copilot.md): arquitetura específica do
  Copilot.
- [machine-learning-no-show.md](./machine-learning-no-show.md): caso de uso de
  ML para previsão de risco de falta.

O primeiro caso de ML não deve ser misturado com regras determinísticas do
booking nem colocado no caminho crítico do agendamento.

## Segurança, privacidade e encerramento

- [session-security.md](./session-security.md): segurança de sessão e
  autenticação.
- [dependency-security.md](./dependency-security.md): dependências e auditoria.
- [encerramento-privacidade.md](./encerramento-privacidade.md): encerramento
  lógico, arquivamento e retenção de dados operacionais.

As regras transversais obrigatórias continuam resumidas em `AGENTS.md`.

## Evidência de qualidade, critérios e histórico

Estes documentos são úteis para rastrear cobertura e evolução, mas não devem
virar uma segunda fonte de regra quando o domínio já possui documento canônico:

- [cobertura-criterios-aceitacao.md](./cobertura-criterios-aceitacao.md):
  cobertura dos critérios de aceitação e fechamentos por wave.
- [wave-16-produto-ux.md](./wave-16-produto-ux.md): evidência do primeiro
  hardening pós-baseline de Produto e UX.
- [wave-17-ativacao-profissional.md](./wave-17-ativacao-profissional.md):
  evidência da proteção da ativação profissional até o primeiro agendamento
  válido.
- [wave-18-recorrencia-segundo-agendamento.md](./wave-18-recorrencia-segundo-agendamento.md):
  evidência do hardening da repetição de booking e recorrência.
- [wave-19-monetizacao-assinatura.md](./wave-19-monetizacao-assinatura.md):
  evidência do hardening do checkout PIX até a assinatura efetivamente ativa.
- [wave-20-retencao-paga.md](./wave-20-retencao-paga.md):
  evidência de renovação, recuperação de cobrança e cancelamento seguro.
- [wave-21-retencao-financeira.md](./wave-21-retencao-financeira.md):
  evidência de classificação da receita recorrente e retenção financeira.
- [wave-22-lifecycle-pago.md](./wave-22-lifecycle-pago.md):
  evidência do lifecycle pago canônico, reativação e encerramento estruturado.
- [wave-23-reconciliacao-base-paga.md](./wave-23-reconciliacao-base-paga.md):
  evidência da reconciliação temporal automática do fim do período pago.
- [wave-24-episodios-pagos-churn.md](./wave-24-episodios-pagos-churn.md):
  evidência de episódios pagos, inadimplência terminal e churn observável v1.
- [wave-25-mrr-nrr.md](./wave-25-mrr-nrr.md):
  evidência do ledger monetário canônico, MRR, GRR e NRR v1.
- [wave-26-ltv-observado.md](./wave-26-ltv-observado.md):
  evidência de coortes maduras e LTV bruto observado D30/D60/D90.
- [wave-27-aquisicao-financeira.md](./wave-27-aquisicao-financeira.md):
  evidência do snapshot de aquisição, CAC de mídia e retorno bruto observado.
- [wave-28-economia-liquida-gateway.md](./wave-28-economia-liquida-gateway.md):
  workstream de netValue, estornos exatos, LTV líquido de gateway e retorno líquido observado.
- [wave-29-margem-contribuicao-observada.md](./wave-29-margem-contribuicao-observada.md):
  workstream de custos variáveis observados, margem de contribuição e LTV de contribuição.
- [wave-30-retorno-contribuicao-cac-midia.md](./wave-30-retorno-contribuicao-cac-midia.md):
  workstream de retorno de contribuição sobre CAC de mídia e recuperação observada.
- [wave-31-fontes-contribuicao-factuais.md](./wave-31-fontes-contribuicao-factuais.md):
  workstream operacional de fontes factuais, custos variáveis, cobertura e auditoria de contribuição.
- [wave-32-sync-custos-contribuicao.md](./wave-32-sync-custos-contribuicao.md):
  ingestão automática provider-agnostic de custos factuais, cursor, cobertura e saúde operacional.

Enquanto uma wave estiver aberta, seu documento descreve o workstream e a
evidência em construção, não uma nova fonte canônica. Quando terminar, a decisão
durável deve estar em `AGENTS.md` e/ou no documento canônico do domínio; o
documento da wave permanece como evidência histórica.

## Como manter a documentação

Ao alterar uma regra durável:

1. atualizar código, migration e testes quando aplicável;
2. atualizar o documento canônico do domínio;
3. atualizar `AGENTS.md` quando a mudança afetar memória operacional;
4. ajustar documentos especializados que dependam da regra;
5. evitar copiar a regra inteira para vários arquivos;
6. manter documentos de wave, auditoria e campanha como evidência, não como
   fonte concorrente.

Ao criar um documento novo, adicionar este índice no mesmo conjunto de mudanças
e indicar claramente se ele é canônico, especializado, runbook ou histórico.

## Regra para consolidação futura

A consolidação deve ser incremental. Antes de remover ou fundir um documento:

1. localizar todas as referências a ele no repositório;
2. confirmar que o conteúdo ainda válido foi preservado no destino;
3. corrigir links e referências;
4. validar que nenhuma regra ficou ambígua;
5. somente então remover o arquivo antigo.

Não fazer uma grande reescrita documental apenas para reduzir a quantidade de
arquivos. O objetivo é reduzir ambiguidade e custo de manutenção, preservando o
conhecimento já adquirido.
