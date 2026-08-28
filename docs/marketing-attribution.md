# Atribuição de marketing

## Regra de integridade da evidência

A evidência bruta de aquisição capturada pelo Agenda Fashion deve ser preservada para auditoria. Rotinas de canonicalização, sincronização de custos e vínculo de campanhas podem resolver identidades e criar metadados auxiliares, mas não podem apagar ou reescrever UTMs, click IDs, landing pages ou eventos já capturados somente para fazer o dado caber na identidade oficial de uma campanha.

Exceções existem apenas quando a remoção é necessária por privacidade, revogação de consentimento, obrigação legal ou política explícita de retenção. Essas rotinas devem permanecer separadas da canonicalização de campanhas.

## Canonicalização

A identidade canônica representa a campanha usada para consolidação e decisão. Ela não substitui a identidade observada no primeiro ou no último toque.

Aliases históricos conhecidos podem permanecer cadastrados como identidades de resolução. No funil profissional, identidades equivalentes são consolidadas em tempo de consulta, preservando o valor original para auditoria.

Para Google Ads de aquisição de profissionais, a identidade canônica interna é:

```text
utm_source=google
utm_medium=cpc
utm_campaign=google_ads_profissionais
```

O destino interno oficial dessa campanha é `/para-profissionais`.

## Funil operacional e atribuição financeira

O painel administrativo deve separar duas perguntas:

1. **O que aconteceu com os profissionais cadastrados no período?** Essa visão usa todos os cadastros profissionais e seus marcos de ativação, independentemente da qualidade da atribuição.
2. **Qual campanha gerou retorno comprovável?** CAC, receita atribuída, ROAS e recomendações de orçamento usam somente a coorte com atribuição oficial suficiente.

Cobertura incompleta nunca pode transformar um cadastro real em cadastro inexistente. Quando a origem não puder ser comprovada, o cadastro permanece no funil operacional e aparece no diagnóstico de qualidade como `sem_evidencia`, `rastreamento_incompleto` ou `identidade_nao_oficial`, conforme o sinal disponível.

Um cálculo como `investimento / todos os cadastros` pode aparecer apenas como diagnóstico bruto quando a atribuição estiver incompleta. Ele não deve ser chamado de CPA, CAC ou custo atribuído e não pode liberar decisões de orçamento.

## Operações em lote

Antes de qualquer rotina destrutiva ou atualização em lote sobre dados de atribuição, deve existir uma estratégia verificável de recuperação, como backup, PITR ou rollback equivalente. Na ausência dela, prefira correções de leitura, metadados auxiliares e mudanças reversíveis.
