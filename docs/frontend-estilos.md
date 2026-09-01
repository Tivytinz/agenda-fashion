# Arquitetura de estilos do frontend

Este documento registra a direção adotada para evoluir o CSS do Agenda Fashion sem introduzir uma nova biblioteca visual ou reescrever o frontend.

## Princípios

1. A experiência pública e a área profissional preservam a identidade visual do Agenda Fashion.
2. O administrativo interno usa linguagem neutra, densa e operacional.
3. CSS global deve conter apenas fundações realmente compartilhadas.
4. Estilos específicos de uma feature não devem ser carregados globalmente quando a feature vive em rotas próprias.
5. Componentes dentro de workspaces com sidebar devem responder à largura real do container. `container queries` são preferíveis a aumentar breakpoints da viewport apenas para esconder overflow.
6. `media queries` continuam válidas para necessidades da viewport, mobile, safe areas e orientação.
7. Não criar novas camadas de versão como `v4`, `v5` ou equivalentes. A evolução deve convergir para um stylesheet canônico por feature.

## Marketing administrativo

O Marketing ainda possui quatro camadas legadas:

- `admin-marketing.css`
- `admin-marketing-professional.css`
- `admin-marketing-v2.css`
- `admin-marketing-v3.css`

Elas permanecem temporariamente para preservar o comportamento existente enquanto a consolidação é feita de forma incremental. A ordem dessas camadas é centralizada em `admin-marketing-entry.js`.

Esses estilos não pertencem ao bundle global inicial. O `AdminLayout` solicita a entrada da feature apenas nas rotas `/admin/trafego-pago*`.

A próxima consolidação deve migrar as regras ainda necessárias para um único `admin-marketing.css`, removendo as camadas legadas somente depois de validação visual e testes. Não apagar uma camada apenas pelo nome: primeiro confirmar quais seletores ainda possuem efeito nas telas de Visão geral, Funil, Custos, GA4 e sincronização.

## Responsividade do admin

O workspace administrativo possui sidebar fixa em desktop, portanto a largura útil de uma página é menor que a viewport. O Marketing define `admin-marketing-page` como container inline e reorganiza o cabeçalho conforme esse espaço real.

A regressão de overflow é protegida em 1024, 1280 e 1366 px, em Chromium e WebKit. A cobertura mobile existente permanece obrigatória.

## Critério de manutenção

Antes de adicionar CSS novo:

- identificar o dono do estilo: base, shell ou feature;
- reutilizar tokens do contexto quando aplicável;
- evitar sobrescrever uma regra antiga se ela puder ser substituída com segurança;
- não criar uma nova geração `vN` para corrigir outra geração;
- testar faixas intermediárias de largura, não apenas celular e desktop grande.
