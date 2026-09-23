# Wave 30 — Retorno de contribuição × CAC de mídia observado v1

> Documento de workstream/evidência do hardening financeiro pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Premissa

A Wave 27 já possui CAC de mídia observado por negócio/campanha e retorno bruto
D30/D60/D90. A Wave 28 acrescentou retorno líquido de gateway. A Wave 29 criou
a infraestrutura de custos variáveis e margem de contribuição, mas ainda não
possui fonte real obrigatória cadastrada nem LTV de contribuição D30/D60/D90
materializado.

A Wave 30 não deve contornar essa dependência. Ela prepara a próxima camada para
comparar contribuição factual com o mesmo investimento de mídia da aquisição,
mantendo a métrica indisponível enquanto a Wave 29 não estiver economicamente
coberta.

## Objetivo

Responder, na mesma coorte financeira por **negócio**:

> Quanto do investimento de mídia observado já foi recuperado pela contribuição
> econômica efetivamente observada?

A primeira versão preserva as janelas canônicas D30/D60/D90 e não projeta
lifetime futuro.

## Fórmula planejada

Quando a janela estiver madura e integralmente coberta:

```text
retorno de contribuição
=
contribuição acumulada observada da coorte
/
investimento de mídia observado da mesma coorte
```

Também poderá ser exposto:

```text
LTV de contribuição / CAC de mídia
=
LTV de contribuição observado
/
CAC de mídia observado
```

Essas duas razões devem usar a mesma unidade, maturidade, campanha e população.

## Recuperação observada

A primeira versão não interpola datas.

Com as janelas D30/D60/D90:

```text
D30 < 1 e D60 >= 1
=> não recuperado em D30
=> recuperado até D60
```

Isso não autoriza afirmar "payback em 47 dias" ou qualquer outro ponto entre as
janelas sem fluxo diário factual.

O nome permitido nesta Wave é **recuperação do CAC de mídia por contribuição
observada**. **Payback econômico definitivo** continua fora do contrato.

## Dependências obrigatórias

Uma janela só poderá disponibilizar retorno de contribuição quando todas estas
condições forem verdadeiras:

1. aquisição financeira oficial da Wave 27 estiver comparável;
2. o dia de aquisição possuir custo de mídia canônico;
3. a janela D30/D60/D90 estiver madura;
4. a economia líquida de gateway da Wave 28 estiver reconciliada para a mesma
   base;
5. a Wave 29 possuir pelo menos uma fonte obrigatória real;
6. todas as fontes obrigatórias cobrirem a janela;
7. o LTV de contribuição da mesma coorte estiver disponível;
8. a quantidade de negócios da base de contribuição coincidir com a base de
   aquisição usada no denominador.

Qualquer divergência mantém a janela indisponível. Casos incompletos não podem
ser retirados do denominador para melhorar a métrica.

## Cutover

A migration 101 cria o marco:

`retorno_contribuicao_v1_inicio`

O marco:

- usa negócio como unidade;
- registra CAC de mídia observado como custo de aquisição desta versão;
- registra contribuição observada como retorno;
- preserva D30/D60/D90;
- não infere histórico anterior;
- explicita que CAC total, payback econômico e decisão automática de mídia não
  estão disponíveis.

A migration não cria nova fonte de custo nem faz backfill econômico.

## Prontidão técnica

A preparação da Wave 30 adiciona uma leitura separada de prontidão que observa:

- cutover da própria Wave;
- cutover da contribuição;
- quantidade de fontes obrigatórias ativas;
- fontes cobertas até hoje;
- início de cobertura das fontes;
- menor watermark de cobertura.

Mesmo quando todas as fontes estiverem cobertas, o retorno continua bloqueado
até que a Wave 29 forneça LTV de contribuição factual.

Esse estado usa o código:

`aguardando_ltv_contribuicao`

Outros bloqueios preparados:

- `base_aquisicao_nao_comparavel`;
- `economia_gateway_incompleta`;
- `sem_fonte_contribuicao`;
- `cobertura_contribuicao_incompleta`.

## Relação com CAC

A Wave 30 reutiliza **CAC de mídia observado**. Não cria CAC total.

Continuam fora do denominador desta versão, salvo futura fonte factual e decisão
de produto específica:

- comercial/vendas;
- comissão;
- produção criativa;
- agência;
- ferramentas comerciais;
- folha/pro-labore;
- overhead;
- infraestrutura fixa;
- outros custos não pertencentes ao investimento de mídia canônico.

Portanto:

```text
CAC de mídia != CAC total
```

## Relação com margem e lucro

Contribuição é posterior à economia líquida de gateway e anterior a lucro
empresarial.

```text
receita bruta
  → receita líquida de gateway
  → custos variáveis de contribuição
  → contribuição observada
  → retorno de contribuição sobre CAC de mídia
```

A Wave 30 não declara:

- lucro líquido;
- EBITDA;
- DRE;
- margem líquida;
- payback econômico total.

## Admin e UX

A leitura pertence principalmente à visão de **Aquisição**, ao lado de CAC de
mídia, retorno bruto e retorno líquido de gateway.

Durante a preparação, o Admin mostra explicitamente que o retorno de contribuição
está indisponível e o motivo correspondente em cada janela.

A tabela reserva:

- retorno de contribuição D30;
- retorno de contribuição D60;
- retorno de contribuição D90;
- recuperação por contribuição.

Nenhum valor desconhecido deve ser mostrado como `0x`, `R$ 0` ou como
recuperação concluída.

## Growth

A Wave é **descritiva**.

Mesmo quando o retorno de contribuição estiver disponível, ele não altera
automaticamente a decisão de escalar, manter ou pausar campanha. A régua de
mídia continua pertencendo ao funil profissional e aos guardrails próprios de
mensuração, amostra, ativação, monetização e atribuição.

## Segurança e integridade

- nenhuma entrada financeira crítica vem do frontend;
- o cálculo reutiliza fatos persistidos no backend;
- nenhum novo ledger de custo é criado por duplicação;
- a mesma mídia não pode ser descontada na margem de contribuição e novamente no
  numerador;
- taxa de gateway e refund não são descontados de novo;
- falha analítica não altera billing ou entitlement;
- dados incompletos bloqueiam a leitura em vez de assumir zero;
- a métrica precisa permanecer reconciliável com aquisição, gateway e
  contribuição.

## Fora do escopo

- CAC total/fully loaded;
- payback econômico definitivo;
- payback em dias exatos por interpolação;
- LTV futuro projetado;
- lucro;
- DRE;
- decisão automática de orçamento;
- atribuição multi-touch nova;
- nova fonte de custo de mídia.

## Critérios de encerramento

1. migration 101 aplicar em banco de teste;
2. nenhum backfill econômico ser inferido;
3. aquisição e contribuição usarem a mesma unidade negócio;
4. D30/D60/D90 reutilizarem as maturidades existentes;
5. ausência de fonte obrigatória bloquear retorno;
6. cobertura incompleta bloquear retorno;
7. economia de gateway incompleta bloquear retorno;
8. LTV de contribuição ausente bloquear retorno;
9. negócio incompleto não ser retirado do denominador;
10. CAC de mídia não ser chamado de CAC total;
11. retorno de contribuição não ser chamado de lucro;
12. recuperação por contribuição não ser chamada de payback econômico
    definitivo;
13. Admin comunicar indisponibilidade sem mostrar zero artificial;
14. billing/entitlement permanecerem independentes;
15. backend e frontend possuírem testes proporcionais ao risco;
16. integração PostgreSQL validar o cutover e prontidão;
17. CI completo ficar verde;
18. diff final ser revisado antes de qualquer merge.

## Estado atual

A Wave 30 está **tecnicamente preparada na branch de trabalho**, com:

- migration 101 e cutover próprio;
- repository read-only de prontidão da contribuição;
- integração da prontidão ao retorno de aquisição;
- estados de bloqueio por janela;
- contratos reservados para retorno/LTV de contribuição;
- estado explícito de indisponibilidade no Admin;
- testes unitários, frontend e integração PostgreSQL;
- documentação e memória operacional alinhadas.

A Wave **não está encerrada** e nenhuma métrica de retorno de contribuição foi
declarada disponível. O bloqueio é intencional enquanto a Wave 29 não possuir
fonte factual obrigatória e LTV de contribuição D30/D60/D90.
