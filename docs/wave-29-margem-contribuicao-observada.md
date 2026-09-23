# Wave 29 — Margem de contribuição observada v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Premissa

A Wave 28 adicionou a camada de economia líquida do gateway sem alterar o
contrato de billing. O estado atual já separa valor bruto, `netValue`, refunds
concluídos, taxa observada do gateway e receita líquida de gateway.

O runtime e o Admin ainda mantêm margem de contribuição e lucro como
indisponíveis. A Wave 29 existe para fechar somente a próxima camada econômica:
**custos variáveis de contribuição observados** e **margem de contribuição
observada**, sem antecipar lucro, CAC total ou payback.

## Objetivo

Transformar receita líquida de gateway em contribuição observável sem inventar
custos ausentes e sem misturar aquisição de mídia com custo operacional variável.

A leitura deve preservar separadamente:

```text
valor bruto da cobrança
netValue observado
refunds DONE
receita líquida de gateway
custos variáveis de contribuição observados
margem de contribuição observada
```

A fórmula v1 será válida somente quando a cobertura econômica da janela estiver
completa:

```text
margem de contribuição observada
=
receita líquida de gateway
-
SUM(custos variáveis de contribuição observados)
```

Quando a receita líquida de gateway for positiva, a taxa de contribuição poderá
ser apresentada como:

```text
margem de contribuição %
=
margem de contribuição observada
/
receita líquida de gateway
```

Margem negativa é um resultado válido. Dado ausente não é zero.

## Fronteira com a Wave 28

A taxa do gateway já está refletida no `netValue`. A Wave 29 não pode descontar
essa taxa novamente.

Refund `DONE` já reduz a receita líquida de gateway na Wave 28. A Wave 29 não
pode lançar o mesmo refund como novo custo de contribuição.

Pagamento economicamente incompleto continua indisponível para leituras que
dependem dele. A Wave 29 herda essa restrição e não cria uma rota paralela para
contornar cobertura ausente.

## O que conta como custo de contribuição

Somente um custo variável com evidência factual, valor persistido e regra de
atribuição explícita pode entrar no cálculo.

Cada fonte deverá possuir, no mínimo:

- origem identificável;
- chave idempotente estável;
- valor monetário factual;
- instante ou competência econômica;
- negócio ao qual o custo é atribuível;
- categoria explícita e versionada;
- evidência de cobertura suficiente para distinguir **zero real** de
  **dado ausente**.

A Wave 29 não deve criar percentuais estimados, médias genéricas ou custos
presumidos para preencher lacunas.

Se uma fonte manual for necessária, a escrita deve ser restrita ao backend/admin,
com ator, motivo e trilha de auditoria. O navegador nunca será autoridade para
valor financeiro crítico.

## Custos que permanecem separados

Investimento de Google Ads, Meta Ads, TikTok Ads, Pinterest Ads e outras mídias
continua pertencendo à aquisição/CAC de mídia. Esse gasto não entra novamente na
margem de contribuição.

Custos fixos ou não diretamente atribuíveis também ficam fora da v1, incluindo
rateios de infraestrutura fixa, folha, pró-labore, suporte geral e overhead
administrativo.

Uma categoria só poderá migrar para o cálculo quando existir fonte real,
atribuição defensável e cobertura verificável.

## Modelo de dados planejado

A implementação deve criar uma nova migration, prevista como
`100_margem_contribuicao_observada_v1.sql`, sem alterar migrations já aplicadas.

O desenho deve incluir:

1. cutover explícito em `financeiro_marcos`, com histórico anterior não
   inferido;
2. ledger idempotente/append-only para custos de contribuição;
3. mecanismo explícito de cobertura por fonte/categoria/período, para que ausência
   de lançamento nunca seja interpretada silenciosamente como custo zero;
4. índices para leitura por negócio, competência e chave de origem;
5. constraints que impeçam valor financeiro inválido e duplicação da mesma
   evidência.

A modelagem final deve ser revisada contra as fontes reais antes de fixar a
taxonomia definitiva de categorias.

## Billing versus contribution economics

Billing permanece autoridade para entitlement.

A margem de contribuição é uma camada analítica posterior:

```text
webhook / billing
  → estado financeiro persistido
  → economia líquida do gateway
  → custos de contribuição observados
  → margem de contribuição observada
```

Falha de ingestão, cobertura ou cálculo da margem não pode cancelar, ativar,
reativar ou alterar plano/assinatura.

## LTV de contribuição

A Wave 29 deve reutilizar exatamente a unidade **negócio**, a coorte de primeira
conversão paga e as maturidades D30/D60/D90 da Wave 26.

Também deve herdar a cobertura econômica da Wave 28.

Uma janela só poderá expor LTV de contribuição quando:

- a receita líquida de gateway da janela estiver coberta;
- os custos de contribuição exigidos para a mesma janela estiverem cobertos;
- a coorte estiver madura para D30, D60 ou D90.

Negócios incompletos não podem ser retirados do denominador para melhorar a
média. A janela inteira deve permanecer indisponível ou apresentar claramente a
cobertura insuficiente.

## Admin e UX

O Admin de Receita já possui os placeholders **Margem de contribuição —
Indisponível** e **LTV econômico / margem — Indisponível**.

A Wave 29 deve evoluir essa área sem confundir conceitos, mostrando quando
coberto:

- receita líquida de gateway;
- custos variáveis de contribuição observados;
- margem de contribuição observada;
- margem de contribuição percentual;
- cobertura econômica;
- LTV de contribuição D30/D60/D90.

Enquanto faltar cobertura, a interface deve explicar a razão e manter a métrica
indisponível. Não mostrar `R$ 0,00` como substituto para dado desconhecido.

**Lucro** continua indisponível.

## Analytics e growth

A Wave 29 é descritiva. Ela não altera automaticamente a régua de escala ou
pausa de mídia.

O CAC de mídia observado da Wave 27 continua separado. A combinação de aquisição
com margem para payback econômico fica para uma etapa posterior, depois que a
contribuição estiver tecnicamente confiável.

## Segurança e integridade

- valores críticos são validados no backend;
- nenhuma escrita financeira confia em valor enviado pelo frontend;
- operações de ingestão/replay devem ser idempotentes;
- isolamento por negócio é obrigatório;
- correções precisam manter trilha auditável;
- segredos de provedores não podem ser persistidos em payloads ou logs;
- falha da camada analítica não pode reverter billing;
- agregados devem ser reconciliáveis com o ledger factual.

## Fora do escopo

- lucro líquido;
- EBITDA ou DRE completa;
- rateio de custos fixos;
- folha, pró-labore e overhead sem atribuição factual;
- CAC total da empresa;
- payback econômico definitivo;
- LTV:CAC econômico definitivo;
- decisão automática de orçamento;
- projeção de lifetime futuro.

## Sequência de implementação

1. confirmar as fontes reais de custos variáveis disponíveis;
2. fechar taxonomia e regra de cobertura;
3. criar migration 100 e ledger;
4. implementar repositories/services de ingestão e agregação;
5. integrar a leitura à Receita/Admin Analytics V2;
6. adicionar LTV de contribuição D30/D60/D90;
7. cobrir replay, correção, cobertura incompleta e isolamento;
8. executar Jest + PostgreSQL, frontend tests e Playwright;
9. revisar o diff completo;
10. somente então atualizar a memória durável em `AGENTS.md` e documentos
    canônicos com o comportamento efetivamente implementado.

## Critérios de encerramento

1. migration 100 aplicar no banco de teste;
2. não existir backfill econômico inferido;
3. custo ausente nunca virar zero implicitamente;
4. taxa do gateway não ser descontada duas vezes;
5. refund já tratado pela Wave 28 não virar custo duplicado;
6. mídia paga não entrar na margem de contribuição;
7. cada custo aceito possuir fonte e chave idempotente;
8. replay da mesma evidência não duplicar custo;
9. correção de custo manter auditoria;
10. margem negativa ser suportada;
11. cobertura incompleta bloquear a métrica correspondente;
12. LTV de contribuição reutilizar coorte/maturidade D30/D60/D90 da Wave 26;
13. janela incompleta não excluir negócios para melhorar a média;
14. billing e entitlement permanecerem independentes da camada de contribuição;
15. Admin distinguir receita líquida, contribuição e lucro;
16. testes backend/PostgreSQL/frontend cobrirem os novos invariantes;
17. Playwright proteger a leitura administrativa principal;
18. Backend CI ficar verde;
19. diff final ser revisado antes de qualquer merge.

## Estado atual

A fundação técnica da Wave 29 foi mergeada no PR #289 pelo commit
`0723d70cdaaadafdcbe4937c1f5b9afcfc852bcc`, com **Backend CI #1362** verde.

O PR #292 completa a lacuna técnica restante da Wave ao implementar **LTV de
contribuição D30/D60/D90** sobre as mesmas coortes por negócio da Wave 26. A
leitura herda a reconciliação econômica da Wave 28 e exige cobertura integral
das fontes obrigatórias de contribuição; negócio maduro incompleto não é
retirado do denominador para melhorar a média.

Com isso, o código da Wave cobre:

- migration 100 com cutover próprio;
- registro de fontes sem seed especulativo;
- ledger idempotente de débito/crédito por negócio;
- watermark de cobertura por fonte;
- service interno que bloqueia replay conflitante e cobertura regressiva;
- margem de contribuição com cobertura factual completa;
- LTV de contribuição D30/D60/D90 com bloqueio de janela incompleta;
- estado explícito no Admin quando margem/LTV continuam indisponíveis;
- testes unitários, frontend e integração PostgreSQL proporcionais ao risco.

A dependência restante é **factual**, não deve ser preenchida por suposição:
o repositório ainda não possui uma fonte real obrigatória de custo variável
(imposto, suporte, infraestrutura variável ou outra categoria comprovada) com
valor e cobertura observáveis. Enquanto nenhuma fonte real for conectada ou
cadastrada, margem e LTV de contribuição permanecem corretamente
**indisponíveis** em produção; ausência de fonte nunca vira custo zero.
