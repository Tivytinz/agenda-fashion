# Inteligência de crescimento do Agenda Fashion

## Objetivo

A inteligência de crescimento transforma métricas já calculadas e autorizadas pelo backend em oportunidades priorizadas para negócios que concluíram a ativação.

Ela é uma camada separada da máquina canônica de ativação. A ativação continua responsável por serviço ativo, agenda confirmada, publicação e primeiro agendamento. A inteligência de crescimento só entra depois de `ATIVADO` e nunca altera essas regras.

## Arquitetura

O fluxo inicial é determinístico e não depende de LLM:

```text
dashboard autorizado
  -> sinais normalizados
  -> avaliadores de oportunidade
  -> score heurístico de impacto x confiança x urgência
  -> ranking
  -> oportunidade principal
```

Os módulos ficam em:

- `src/services/growthIntelligence/signalService.js`: normaliza apenas sinais necessários e compatíveis;
- `src/services/growthIntelligence/opportunityService.js`: avaliadores independentes geram oportunidades candidatas;
- `src/services/growthIntelligence/recommendationService.js`: calcula o score e ordena as candidatas;
- `src/services/growthIntelligenceService.js`: orquestra ativação, suficiência de dados e resposta final.

`dashboardDonoService` reaproveita o dashboard já autorizado. Não existe SQL novo na camada de service e esta primeira versão não exige migration.

A camada é secundária ao dashboard. Se a análise lançar uma exceção inesperada, `dashboardDonoService` devolve `INDISPONIVEL` e preserva as demais informações da tela. A inteligência nunca deve transformar uma consulta válida do dashboard em erro operacional.

## Contrato

`GET /dashboard-dono` passa a incluir `inteligencia_crescimento`:

```json
{
  "inteligencia_crescimento": {
    "status": "OPORTUNIDADE_PRIORIZADA",
    "periodo": "30dias",
    "oportunidade_principal": {
      "codigo": "CONVERSAO_SEM_AGENDAMENTO",
      "categoria": "conversao",
      "titulo": "Transforme visitas em agendamentos",
      "mensagem": "...",
      "impacto": 1,
      "confianca": 0.75,
      "urgencia": 0.9,
      "score": 0.675,
      "evidencias": [],
      "acao": {
        "tipo": "NAVEGAR",
        "rotulo": "Revisar meu perfil",
        "destino": "/painel/negocio"
      }
    },
    "oportunidades": []
  }
}
```

Estados possíveis:

- `AGUARDANDO_ATIVACAO`: a máquina de ativação ainda tem prioridade;
- `DADOS_INSUFICIENTES`: ainda não há amostra mínima para recomendar;
- `SEM_OPORTUNIDADE_PRIORITARIA`: há dados, mas nenhuma regra atual gerou hipótese suficientemente útil;
- `OPORTUNIDADE_PRIORIZADA`: existe uma oportunidade principal;
- `INDISPONIVEL`: a camada secundária falhou e o dashboard foi preservado.

`impacto`, `confianca`, `urgencia` e `score` são heurísticas internas de priorização em escala normalizada. `confianca` não representa probabilidade estatística, intervalo de confiança nem garantia causal.

## Sinais usados no V1

A primeira versão usa sinais do mesmo contrato de dashboard e evita misturar métricas com janelas incompatíveis:

- visitas ao perfil;
- agendamentos concluídos observados pelos eventos de produto;
- taxa de conversão já calculada pelo backend;
- cliques em WhatsApp;
- cliques em Maps;
- favoritos recebidos;
- total de serviços vendidos/agendamentos não cancelados no período;
- ranking de serviços do período.

`clientes_recorrentes` não é usado nesta versão porque o valor atual é histórico, enquanto os demais sinais de performance respeitam o período selecionado. Misturar essas janelas produziria recomendações difíceis de interpretar corretamente.

Para participação de serviço, o denominador é `resumo.servicos_vendidos`, que cobre todos os agendamentos não cancelados do período. O `ranking_servicos` limitado aos primeiros itens serve somente para identificar o serviço líder; ele não é usado como denominador, evitando inflar artificialmente a participação quando existem mais serviços fora do top 5.

## Oportunidades iniciais

### Conversão sem agendamento

Só é considerada com pelo menos 20 visitas ao perfil no período. O texto apresenta os fatos e recomenda revisão; não atribui causa.

### Conversão baixa com amostra

Só é considerada com pelo menos 40 visitas e conversão de até 5%. O limite é uma heurística interna de triagem, não benchmark de mercado e não deve ser apresentado como verdade universal.

### Interesse sem conclusão proporcional

Compara ações de interesse registradas com agendamentos concluídos. O texto usa linguagem de hipótese e não afirma que WhatsApp, Maps ou favoritos causaram perda de reservas.

### Serviço com tração concentrada

Quando há pelo menos oito agendamentos não cancelados no período e um serviço concentra ao menos metade deles, a camada pode sugerir usar esse serviço na divulgação. O compartilhamento continua usando o mecanismo rastreável existente do AF.

## Segurança e privacidade

A resposta estruturada não inclui ranking de clientes, nomes, WhatsApp, e-mail ou outros dados pessoais. O frontend recebe apenas sinais agregados necessários para explicar a oportunidade.

Destinos de navegação são validados por allowlist no componente. Uma ação de compartilhamento reutiliza `PublicShareButton`; a camada não cria uma segunda mecânica de share.

A integração não cria rota nova nem aceita `negocio_id` fornecido pelo frontend. Ela executa sobre o resultado de `dashboardService.buscarDashboardDono`, cuja autorização e vínculo do dono já foram validados no backend.

## Observabilidade

A interface registra eventos separados:

- `oportunidade_crescimento_visualizada`;
- `oportunidade_crescimento_selecionada`.

Esses nomes e as propriedades `codigo_oportunidade`, `categoria_oportunidade` e `tipo_acao` fazem parte da allowlist de `eventoProdutoService`. Dados pessoais continuam descartados pelo sanitizador.

Esses eventos medem uso da recomendação, não sucesso. O resultado deve ser analisado depois pelos marcos reais do negócio, como evolução da conversão, agendamentos e recorrência.

## Copilot AF V1

A primeira camada generativa usa a oportunidade estruturada somente quando o motor determinístico recomenda `COMPARTILHAR_PERFIL`. O fluxo, contratos de privacidade, fallback, rate limit e configuração do provider estão em [`copilot-v1.md`](./copilot-v1.md).

O LLM pode redigir uma mensagem mais natural e personalizada, mas não recalcula métricas nem decide qual oportunidade deve ser priorizada. O backend continua sendo a autoridade para ativação, oportunidade, permissões, disponibilidade, preços, planos, publicação e regras financeiras.

Se a integração de IA estiver indisponível, a geração cai para um texto determinístico e o mecanismo rastreável de compartilhamento continua funcionando.

## Evolução posterior

Depois de validar uso, custo, qualidade e impacto no funil, uma futura camada pode:

- explicar oportunidades em linguagem mais natural;
- comparar hipóteses com amostra suficiente;
- responder perguntas sobre sinais agregados autorizados;
- ajudar a melhorar descrições opcionais de perfil e serviço.

Mesmo nessas fases, o LLM não deve recalcular métricas canônicas, escolher permissões, publicar negócios, alterar horários, preços, planos ou regras financeiras. A máquina determinística deve continuar plenamente funcional quando a IA estiver indisponível.
