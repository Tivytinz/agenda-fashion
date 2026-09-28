# Console administrativo do Agenda Fashion

> **Papel documental:** fonte canônica para arquitetura de informação, navegação e separação semântica do contexto administrativo. Documentos de visão geral, centro de comando e Marketing aprofundam páginas e métricas específicas.

## Objetivo

A administração do AF é um centro de comando operacional e analítico. O objetivo é ajudar a responder, sem confundir sinais de natureza diferente:

1. como a aquisição está trazendo profissionais;
2. onde a jornada perde valor até o primeiro agendamento;
3. se os profissionais e negócios voltam a usar o produto;
4. como a monetização está evoluindo;
5. como negócios, agendamentos e marketplace estão se comportando;
6. se integrações e rotinas operacionais relevantes exigem atenção.

Cadastros, cliques, sessões, checkout, agendamento e receita permanecem conceitos diferentes.

## Baseline exclusiva de requisitos

A cobertura funcional geral do AF e a cobertura do Admin são métricas
independentes.

A baseline administrativa canônica para rastreabilidade fica em
[`admin-requisitos-matriz.md`](./admin-requisitos-matriz.md). Ela possui
denominador próprio e não deve reutilizar automaticamente o percentual
`67/67` da baseline funcional geral.

Um requisito administrativo só é considerado coberto quando existe evidência
verificável proporcional ao risco. Interface sem contrato de backend suficiente
não fecha requisito de segurança, dinheiro, permissão ou integridade.

## Arquitetura de informação atual

A navegação principal do Admin é definida por uma única lista compartilhada
entre o sidebar desktop e o painel de navegação mobile. As páginas são
agrupadas por tarefa:

- **Início:** `/admin` — Visão geral;
- **Crescimento:** `/admin/trafego-pago` — Marketing,
  `/admin/trafego-pago/custos` — Investimento e eficiência,
  `/admin/integracoes` — Integrações, `/admin/aquisicao` — Aquisição,
  `/admin/jornada` — Jornada,
  `/admin/retencao` — Retenção e `/admin/receita` — Receita;
- **Plataforma:** `/admin/operacao` — Operação,
  `/admin/saude` — Saúde do SaaS, `/admin/whatsapp` — WhatsApp;
  para superadmin, também `/admin/auditoria` — Auditoria.

Marketing cobre canais e campanhas; Investimento e eficiência apresenta custos,
e Integrações concentra conexões e sincronização. Aquisição mostra o
resultado das origens no funil de profissionais. Saúde do SaaS reúne diagnóstico
de ativação com filas e workers. No celular, o botão Menu abre a lista completa,
sem uma segunda navegação fixa sobre o conteúdo. Cada página seleciona seu
próprio link; o caminho antigo `/admin/trafego-pago/custos#integracoes-custos`
leva à página de Integrações.

`/admin/auditoria` é uma consulta especializada do superadmin para rastrear
tentativas e resultados das ações críticas. O contrato e os limites desta
leitura ficam em `admin-wave-2-rf41-auditoria.md`.
Revisões humanas das pendências vencidas preservam o resultado HTTP desconhecido;
o contrato está em `admin-wave-3-rf41-reconciliacao.md`.

`/conta` continua acessível pelo botão Conta no topo da administração.

Essa arquitetura pode evoluir quando houver ganho claro de operação. O importante é preservar a separação semântica entre aquisição, ativação/jornada, retenção, monetização e operação.

## Estado atual x período

As páginas administrativas podem misturar duas naturezas de informação, desde que isso fique claro:

- **estado atual**: sinais operacionais que descrevem a situação corrente da plataforma ou de uma integração;
- **desempenho no período**: métricas de aquisição, jornada, agendamentos, retenção e receita calculadas para o recorte selecionado.

Quando um indicador representa pessoas ou eventos, o rótulo deve indicar a entidade medida. “Clientes que agendaram”, por exemplo, não é sinônimo de total de contas de clientes cadastradas.

Na Visão geral, **Contas que acessaram** conta IDs de contas autenticadas distintas em sessões iniciadas no período. As sessões e visualizações também incluem visitas sem login. Esse indicador não representa visitantes únicos nem o total de contas cadastradas; vínculos entre visitante e conta não permitem inferir retroativamente uma pessoa única em navegadores compartilhados.

Em Aquisição, sessões por origem podem ser somadas; identidades distintas calculadas separadamente por origem não podem, pois uma mesma conta ou visitante pode aparecer em mais de uma origem. O resumo e a tabela priorizam sessões e engajamento para não exibir uma soma enganosa de “usuários”.

Períodos administrativos navegáveis podem ser persistidos em `?periodo=` quando a página suporta essa dimensão. Durante a troca de período, manter os últimos dados válidos visíveis pode reduzir saltos de layout, desde que a interface deixe claro quando eles ainda pertencem ao recorte anterior.

Ausência de uma fonte ou falha de leitura não deve ser convertida silenciosamente em zero. `0` representa valor confirmado igual a zero; indisponibilidade pode aparecer como `—`, “não verificado” ou estado equivalente.

Subáreas de Marketing que compartilham o mesmo recorte devem preservar `?periodo=` quando isso evitar perda de contexto durante a navegação.

## Funil profissional

A leitura canônica de ativação acompanha:

**Cadastro → Negócio criado → Serviço ativo → Negócio publicado → Primeiro agendamento válido.**

Checkout iniciado e assinatura paga pertencem à monetização e podem ser apresentados depois desses marcos quando a análise exigir o funil comercial completo.

A agenda não é gate de ativação nem de publicação. O AF inicializa uma disponibilidade padrão ao criar o negócio; personalização de horários e eventuais inconsistências de disponibilidade podem ser diagnosticadas separadamente porque afetam a qualidade operacional do agendamento, mas não alteram o percentual canônico de ativação.

Esses marcos não devem ser transformados automaticamente em causalidade. Dependendo da coorte e do legado, análises adjacentes podem exigir regras específicas antes de serem chamadas de conversão.

## Fontes de dados

A administração reutiliza APIs protegidas e mantém separação entre operação, produto e marketing. Entre as fontes existentes estão:

- `GET /health/ready` — prontidão da aplicação e do banco;
- endpoints de Analytics V2 usados por Visão geral, Aquisição, Jornada, Retenção, Receita e Operação;
- `GET /admin/saude/perfis-incompletos` — diagnóstico operacional de ativação;
- `GET /admin/usuarios` — usuários com busca, estado e paginação server-side;
- `GET /admin/negocios` — negócios com busca, estado operacional e paginação server-side;
- `GET /admin/agendamentos` — agendamentos com busca, estado canônico e paginação server-side;
- endpoints de Marketing para atribuição, custos, funil e integrações;
- endpoints de WhatsApp para templates, automações e métricas de envio.

Os endpoints administrativos permanecem protegidos por autenticação e autorização administrativa. Dados sensíveis não devem ser expostos ao frontend apenas por conveniência de operação.

## Operação paginada

A Admin Wave 1 reconcilia o módulo com o RF40 da Especificação v1.17. A operação
passa a tratar usuários, negócios e agendamentos como superfícies explícitas de
diagnóstico, mantendo Marketplace separado.

`/admin/operacao` usa busca e paginação no backend para continuar correta conforme a base cresce. A interface não deve limitar pesquisa a uma amostra já carregada no navegador.

Contratos existentes incluem:

- `GET /admin/negocios?busca=&pagina=1&limite=25`
- `GET /admin/usuarios?busca=&status=&pagina=1&limite=25`
- `GET /admin/negocios?busca=&status=&pagina=1&limite=25`
- `GET /admin/agendamentos?busca=&status=&pagina=1&limite=25`

O limite padrão é 25 e o backend limita a página a no máximo 100 registros. A resposta inclui `paginacao` com `pagina`, `limite`, `total` e `totalPaginas`.

A listagem administrativa de agendamentos não precisa devolver o WhatsApp do cliente final para cumprir sua finalidade operacional.

Manter `aba`, `busca`, `status` e `pagina` na query string, quando aplicável, ajuda reload, histórico do navegador e compartilhamento do mesmo recorte.

## Diagnóstico de ativação

A rota histórica `/admin/saude` pode continuar oferecendo filtros para localizar pendências de negócio, serviço, publicação e outros sinais operacionais existentes.

Questões de disponibilidade podem aparecer ali como diagnóstico técnico, mas não devem ser descritas como etapa obrigatória de ativação ou publicação.

Quando existir um destino operacional claro, cards ou atalhos podem abrir o filtro correspondente para evitar que o administrador repita manualmente o contexto.

## Semântica de métricas

GA4 explica navegação e comportamento. Banco e eventos canônicos do AF continuam sendo a fonte para ativação, agendamento, assinatura e receita.

Cobertura de atribuição paga, cobertura de sessões e cobertura financeira são conceitos diferentes e devem manter os denominadores definidos pelo backend. A interface não deve renomear uma dessas métricas como se representasse outra.

Status de agendamento usam cor apenas como reforço semântico; o texto do status continua importante para acessibilidade e precisão.

## Privacidade e operação

A operação administrativa prioriza leitura e diagnóstico. Ações destrutivas ou de alto impacto exigem justificativa própria, autorização e proteções proporcionais.

Na visão de agendamentos, dados de contato do cliente final não precisam ser exibidos quando não são necessários para a tarefa. Em diagnósticos de profissionais, qualquer atalho de contato continua condicionado às regras existentes de consentimento e privacidade.

## UX

Como orientação para as telas administrativas:

- loading, erro e dados parciais devem preservar o máximo possível de informação válida;
- troca de período pode manter dados anteriores visíveis quando o contexto carregado estiver identificado;
- ausência ou falha de leitura não deve aparecer como `0` sem evidência;
- navegação e tarefas principais precisam funcionar em mobile e WebKit;
- tabelas podem permanecer tabulares no desktop e adotar composição mais adequada em telas estreitas quando isso melhorar leitura;
- busca e paginação server-side são preferíveis para conjuntos operacionais grandes;
- cores de marca e cores semânticas devem ajudar a leitura, não substituir rótulos ou significado.
