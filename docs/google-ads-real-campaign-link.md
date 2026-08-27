# Vínculo real com Google Ads

A integração de custos e atribuição do Google Ads preserva duas identidades diferentes:

- a campanha canônica interna do Agenda Fashion, usada nos relatórios do produto;
- a campanha original da conta Google Ads, identificada pela conta configurada e pelo `campaign.id` devolvido pela API.

A campanha interna nunca substitui o identificador externo do Google.

## Vínculo normal

Quando um vínculo é criado pelo painel administrativo, o backend não confia no nome ou no ID enviados pelo navegador. Ele consulta a campanha novamente no Google Ads e persiste em `marketing_campanha_vinculos` a conta real, o `campaign.id` real e o nome retornado pela API.

## Auto-reparo da campanha de aquisição profissional

A campanha canônica `google_ads_profissionais` pode ter perdido seu vínculo externo durante consolidações históricas. O backend pode reconstruir esse elo automaticamente sem ação manual quando todas as condições abaixo forem satisfeitas:

1. a integração Google Ads está configurada;
2. a campanha interna canônica existe, está ativa, pertence ao canal Google e tem objetivo profissional;
3. ainda não existe um vínculo externo válido para ela;
4. a API do Google Ads devolve exatamente uma campanha `SEARCH` de aquisição de profissionais compatível;
5. essa campanha teve gasto real no período de reconciliação;
6. a identidade externa não está vinculada a outra campanha do AF;
7. uma nova consulta direta ao Google confirma a mesma conta e o mesmo `campaign.id` antes da gravação.

Se nenhuma campanha puder ser comprovada ou se mais de uma candidata permanecer possível, o backend mantém o rastreamento incompleto. Ele não escolhe por quantidade de campanhas internas, por nome de usuário, por cidade, nem por conhecimento manual de quem veio do anúncio.

No startup, depois de verificar a identidade original do Google Ads, o backend executa uma nova reconciliação tanto quando o vínculo foi reparado quanto quando ele já estava válido. Isso garante que sincronizações históricas ainda não auditáveis possam ser atualizadas sem depender da flag do agendamento periódico ou de sincronização manual. O worker agendado continua verificando o vínculo antes das sincronizações futuras e pode tentar novamente em execuções posteriores caso a API tenha ficado temporariamente indisponível.

Esse comportamento mantém a regra de atribuição conservadora do AF: CAC, ROAS e funil oficial só recebem aquisições cuja campanha possa ser demonstrada por evidência persistida e verificável.
