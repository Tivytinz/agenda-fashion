# Painel de campanhas e tráfego

Este documento registra o contrato do painel administrativo de marketing do Agenda Fashion.

## Sessões de aquisição

O painel de campanhas não trata qualquer uso do SaaS como uma nova visita de aquisição.
Uma sessão só entra nas métricas de tráfego quando o primeiro evento registrado ocorreu em uma superfície pública de entrada, descoberta, cadastro ou planos.

Entradas iniciadas em dashboard, agenda, administração ou outras áreas internas não contam como aquisição, mesmo que o navegador ainda preserve uma atribuição de primeiro contato válida.

As categorias principais são mutuamente distintas:

- **campanha oficial**: há sinal pago e a identidade de origem, mídia e campanha corresponde a uma campanha cadastrada no AF;
- **pago sem campanha identificada**: há sinal de mídia paga, mas falta uma campanha oficial resolvida; fica fora de CAC, ROAS e recomendações;
- **orgânico**: entrada pública não paga com origem orgânica reconhecida;
- **direto**: entrada pública sem anúncio, UTM ou origem orgânica detectada.

`gclid`, `gbraid` e `wbraid` comprovam tráfego Google pago, mas não autorizam o backend a inventar uma campanha ausente.

## Resultado por objetivo

Campanhas oficiais precisam ter um objetivo explícito.

### Aquisição de profissionais

O resultado vem do funil persistido de profissionais e acompanha:

`cadastro → negócio criado → serviço cadastrado → agenda configurada → negócio publicado → checkout → assinatura ativada`

O card de cadastros profissionais usa `resumoOficial` do funil profissional. Agendamentos feitos posteriormente no marketplace não são tratados como a conversão primária dessa campanha.

### Aquisição de clientes

O resultado primário é `agendamento_concluido` atribuído a uma campanha oficial com objetivo `cliente`.

Agendamentos ligados a campanhas cujo objetivo é `profissional` não entram no card nem na lista de conversões de cliente.

## Período

Os filtros Hoje, 7 dias, 30 dias, Este mês e Todo período afetam métricas de desempenho e coortes.

A quantidade de campanhas ativas é um dado operacional do cadastro de campanhas e, por isso, não deve ser apresentada como se fosse uma métrica limitada pelo período selecionado.

## Auditoria

O modelo de atribuição continua sendo primeiro contato em janela de 30 dias, com último contato preservado para auditoria. Nenhuma correção do painel deve reescrever retroativamente cliques pagos sem identidade suficiente de campanha.
