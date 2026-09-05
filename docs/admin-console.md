# Console administrativo do Agenda Fashion

## Objetivo

A administração do AF é um centro de comando operacional. Ela deve responder, em ordem:

1. o sistema está pronto para operar;
2. onde profissionais estão travando na ativação;
3. como negócios, agendamentos e marketplace estão se comportando;
4. qual aquisição gera ativação, primeiro agendamento, recorrência e receita;
5. se WhatsApp e automações estão saudáveis.

Cadastros, cliques e sessões não são tratados como equivalentes a ativação, agendamento ou receita.

## Arquitetura de informação

- `/admin` — **Visão geral / Centro de comando**.
- `/admin/saude` — **Ativação profissional**. A rota histórica é preservada por compatibilidade, mas a interface não usa mais “Saúde do SaaS” para este fluxo.
- `/admin/operacao` — **Operação da plataforma**, com negócios, agendamentos e sinais do marketplace.
- `/admin/trafego-pago` — **Marketing**, incluindo aquisição, funil, custos e retorno.
- `/admin/whatsapp` — **WhatsApp e automações**.
- `/conta` — **Minha conta**.

No mobile, os quatro primeiros destinos aparecem na navegação primária. WhatsApp e Minha conta ficam em “Mais”.

## Fontes de dados

A primeira versão reutiliza APIs administrativas existentes e não cria nova tabela nem migration:

- `GET /health/ready` — prontidão da aplicação e do banco. Não representa saúde de workers ou integrações externas.
- `GET /admin/dashboard` — indicadores, comportamento, qualidade e sinais gerais da plataforma.
- `GET /admin/saude/perfis-incompletos` — ativação e próxima ação por profissional.
- `GET /admin/negocios` — negócios cadastrados.
- `GET /admin/agendamentos` — agendamentos da plataforma.
- `GET /admin/marketing` — rankings e cidades do marketplace.
- `GET /admin/marketing/funil-profissionais` — funil profissional.
- `GET /admin/whatsapp/templates` — templates, automações e métricas de envio.

Os endpoints administrativos permanecem protegidos por autenticação e autorização administrativa e não devem ser cacheados por navegador, proxy ou CDN.

## Semântica de métricas

A cobertura de atribuição paga exibida no Marketing usa como denominador o **tráfego pago identificado pelo AF**. Por isso a interface deve explicitar “X% do tráfego pago identificado”, evitando interpretar a métrica como cobertura de todas as sessões do site.

GA4 explica navegação e comportamento. Banco e eventos canônicos do AF continuam sendo a fonte para ativação, agendamento, assinatura e receita.

## Privacidade e operação

A primeira versão de `/admin/operacao` é somente leitura. Ela não adiciona ações destrutivas.

Na visão de agendamentos, dados de contato do cliente final não são exibidos. O objetivo é acompanhar a operação, não expor dados pessoais sem necessidade.

## UX

- loading, erro e dados parciais devem ser tratados por bloco;
- falha de uma fonte não deve apagar dados válidos das demais;
- navegação precisa funcionar em mobile e WebKit;
- tabelas largas devem ser evitadas no mobile; a operação usa cartões responsivos;
- o Admin preserva superfícies neutras e usa cores apenas com significado operacional.
