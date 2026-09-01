# Painel de campanhas e tráfego

Este documento registra o contrato das métricas de aquisição exibidas no painel administrativo de marketing do Agenda Fashion.

## Sessões de aquisição

Uma sessão só entra nas métricas de aquisição quando o **primeiro evento da sessão** ocorre em uma superfície pública de entrada, descoberta, autenticação/cadastro ou planos.

As páginas atualmente aceitas como início de aquisição são:

- `landing`;
- `para_profissionais`;
- `inicio`;
- `perfil_negocio`;
- `catalogo_local`;
- `cadastro_profissional`;
- `cadastro_cliente`;
- `login_profissional`;
- `login_cliente`;
- `planos`.

Sessões iniciadas em áreas internas, como dashboard, agenda ou administração, não representam uma nova aquisição e ficam fora dessas métricas, mesmo quando o navegador ainda possui uma atribuição de marketing persistida.

O período selecionado é aplicado ao início da sessão de aquisição. Depois que a sessão pertence à coorte do período, seus eventos relacionados podem ser usados para medir o resultado daquela sessão.

## Atribuição paga

A exclusão de sessões internas não altera as regras oficiais de atribuição do AF.

A identidade UTM exata continua tendo prioridade. Quando ela não existe, a atribuição assistida só é aceita quando o backend possui evidência suficiente e verificada para resolver a campanha. Identificadores de clique e outros sinais de mídia paga comprovam que houve tráfego pago, mas não autorizam inventar uma campanha ausente.

Sessões pagas cuja campanha não possa ser resolvida com segurança permanecem fora de CAC, ROAS e recomendações dependentes de atribuição confiável.

O método de resolução permanece disponível para auditoria e o histórico não deve ser reescrito por inferência posterior.

## Motivo da regra

Uma pessoa pode entrar no Agenda Fashion por uma campanha e continuar usando o sistema em sessões posteriores. Se uma nova sessão começar diretamente no dashboard, na agenda ou em outra área autenticada, ela representa uso do produto, não uma nova visita de aquisição.

Misturar esses dois comportamentos infla sessões de marketing e distorce taxas, cobertura e leitura de desempenho.

## Testes de regressão

As consultas de resumo, campanhas e conversões devem preservar esta regra. A cobertura de integração precisa demonstrar que:

1. uma sessão iniciada em uma superfície pública continua entrando nas métricas;
2. uma sessão iniciada em uma área interna não entra, mesmo carregando a mesma atribuição paga;
3. conversões da sessão interna não aparecem como conversões daquela aquisição.
