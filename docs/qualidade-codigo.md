# Qualidade de código do frontend

Este documento registra as proteções automáticas usadas para evitar regressões estruturais no frontend do Agenda Fashion.

## ESLint

O `frontend/eslint.config.js` trata variáveis e imports não usados como erro. Apenas nomes iniciados por `_` podem ser ignorados intencionalmente. Componentes React não recebem exceção por começarem com letra maiúscula.

A regra continua usando `react/jsx-uses-vars`, portanto componentes realmente usados em JSX são reconhecidos como utilizados.

## Código morto de produção

O frontend executa uma checagem específica de arquivos de produção não alcançáveis a partir de `src/main.jsx`.

O comando canônico é:

```bash
npm --prefix frontend run check:dead-code
```

A implementação usa Knip com versão fixada no próprio script e roda em modo de produção, limitada ao tipo de problema `files`. O objetivo inicial é detectar arquivos JavaScript/JSX de produção que ficaram órfãos depois de remoções, renomes ou refatorações.

A configuração fica em `frontend/knip.json`. Testes `*.test.*` e `*.spec.*` não fazem parte do conjunto de arquivos de produção usado para esta verificação.

Nesta etapa o gate não tenta bloquear todos os exports ou dependências potencialmente não usados. Expandir o escopo exige auditoria própria para evitar falsos positivos e remoções indevidas.

## CI

O GitHub Actions executa, nesta ordem relevante:

1. lint do frontend;
2. detecção de arquivos mortos do frontend;
3. build;
4. testes de frontend;
5. migrations e testes de backend/coverage;
6. auditorias de dependências;
7. Playwright mobile.

Uma falha na detecção de código morto deve ser tratada pela causa: remover o arquivo realmente órfão ou corrigir a configuração/entrypoint quando houver uso real não reconhecido. Não adicionar exceções apenas para fazer o CI passar.
