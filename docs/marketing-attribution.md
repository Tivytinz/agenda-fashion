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

## Funil pós-agenda

Depois que `agenda_configuracoes.configurado_em` registra a primeira configuração válida da agenda, o painel pode medir a missão operacional de levar o negócio ao primeiro agendamento por uma sequência conservadora de eventos já existentes.

A sequência rastreada é:

1. o dono copia ou compartilha o link público do próprio negócio pelo dashboard ou pela configuração da agenda, depois de a agenda estar configurada;
2. outra sessão visualiza o perfil público depois dessa divulgação, excluindo a sessão que divulgou e visualizações autenticadas do próprio dono;
3. uma sessão visitante que visualizou o perfil avança para `agendamento_iniciado`;
4. a mesma sessão registra `agendamento_concluido`, o `agendamento_id` do evento aponta para uma linha real de `agendamentos` do mesmo negócio, criada depois do início, e essa linha é o primeiro agendamento registrado para aquele negócio.

A primeira visita não precisa ser a sessão que converte. Se uma pessoa visualizar e sair, uma visita posterior ainda pode representar o avanço do negócio até o início e a conclusão do agendamento.

A expressão “após divulgação” descreve ordem temporal. Ela não prova que a visita foi causada pelo link compartilhado, porque o funil de produto não usa esse encadeamento como modelo de atribuição de origem.

Os eventos de produto medem intenção e progressão, mas não substituem a fonte transacional. `agendamento_iniciado` e `agendamento_concluido` isolados nunca devem ser tratados como receita ou como agendamento real. O marco final da jornada rastreada só existe quando o evento de conclusão é validado contra o primeiro registro real da tabela `agendamentos` daquele negócio.

Como a sequência depende da chegada dos eventos de produto, ela pode subestimar a jornada quando houver perda de telemetria. O total geral de primeiros agendamentos continua sendo calculado diretamente a partir da tabela `agendamentos` e permanece a referência operacional para saber se o negócio recebeu seu primeiro agendamento.

Essa leitura pós-agenda serve para localizar perdas entre divulgação, visita, início e conclusão. Ela não altera sozinha CAC, ROAS nem as regras de decisão financeira por campanha.

## Operações em lote

Antes de qualquer rotina destrutiva ou atualização em lote sobre dados de atribuição, deve existir uma estratégia verificável de recuperação, como backup, PITR ou rollback equivalente. Na ausência dela, prefira correções de leitura, metadados auxiliares e mudanças reversíveis.
