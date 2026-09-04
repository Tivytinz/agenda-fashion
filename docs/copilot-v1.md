# Copilot AF V1 — divulgação assistida

## Objetivo

A primeira integração generativa do Agenda Fashion é deliberadamente estreita: ajudar o dono de um negócio ativado a transformar uma oportunidade de divulgação já detectada pelo backend em um texto curto para WhatsApp.

O LLM não substitui a máquina de ativação nem o motor de inteligência de crescimento. A ordem continua sendo:

```text
dados autorizados do dashboard
  -> regras canônicas de ativação
  -> sinais e oportunidades determinísticos
  -> oportunidade de compartilhamento priorizada
  -> contexto seguro
  -> provider de IA opcional
  -> validação de saída
  -> texto editável pelo profissional
  -> compartilhamento pelo link rastreável existente do AF
```

## Escopo V1

O endpoint autenticado é:

```text
POST /dashboard-dono/copilot/divulgacao
```

Payload permitido:

```json
{
  "periodo": "30dias",
  "canal": "whatsapp"
}
```

O frontend não envia `negocio_id`, prompt livre, dados de clientes, preço, disponibilidade ou URL. O backend resolve o negócio pelo usuário autenticado e recalcula o dashboard e a oportunidade atual antes de gerar qualquer texto.

A geração só é aceita quando `inteligencia_crescimento.oportunidade_principal.acao.tipo` é `COMPARTILHAR_PERFIL`. Se a oportunidade atual recomendar outra ação, o endpoint responde conflito e não chama o provedor.

## Contexto enviado ao modelo

O `copilotContextService` mantém uma allowlist pequena:

- nome público do negócio;
- período analisado;
- código, categoria e título da oportunidade;
- evidências agregadas autorizadas;
- nome e quantidade de agendamentos do serviço de destaque, quando aplicável.

Não entram no contexto:

- ranking de clientes;
- nome, telefone, WhatsApp ou e-mail de clientes;
- atendimentos individuais;
- tokens ou credenciais;
- slug ou link público;
- prompt fornecido pelo usuário.

Nomes vindos do banco são tratados como dados, não como instruções.

## Provider OpenAI

O provider usa a Responses API pelo `axios` já presente no backend. Não foi adicionada nova dependência.

Configuração:

```text
COPILOT_AI_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
OPENAI_API_URL=https://api.openai.com/v1/responses
OPENAI_TIMEOUT_MS=8000
```

A flag fica desligada por padrão. A chave é segredo exclusivo do backend e nunca pode ser exposta em `VITE_*`, frontend, logs ou analytics.

As requisições usam:

- `store: false`;
- Structured Outputs com `json_schema` e `strict: true`;
- limite curto de saída;
- timeout configurável;
- instruções explícitas para não inventar preço, promoção, disponibilidade, endereço ou resultado garantido;
- proibição de URL na saída, porque o link rastreável é acrescentado pelo AF depois.

## Fallback e confiabilidade

A integração é fail-soft. Se ocorrer qualquer uma destas situações:

- flag desligada;
- chave ausente;
- timeout;
- erro HTTP;
- resposta vazia;
- JSON inválido;
- saída fora do contrato;
- texto contendo URL;

`copilotShareService` devolve uma sugestão determinística baseada somente no contexto autorizado.

A indisponibilidade do provedor nunca deve derrubar o dashboard nem impedir o compartilhamento do perfil.

## UX

O dashboard só exibe `Criar texto de divulgação` quando a oportunidade principal é de compartilhamento.

Depois da geração:

1. o texto aparece editável;
2. a origem é identificada como `Copilot AF` quando veio do provider ou `Sugestão automática` quando veio do fallback;
3. a profissional é orientada a revisar antes de enviar;
4. `PublicShareButton` reutiliza o link rastreável existente;
5. no fallback do Web Share, texto e link são copiados juntos quando existe texto personalizado.

O texto gerado nunca é enviado automaticamente.

## Rate limit e custo

A rota possui limite específico de 12 solicitações por hora por usuário autenticado. Isso protege custo, abuso e chamadas repetitivas acidentais.

Uma futura expansão de plano/cotas de IA deve ser validada no backend e não pode depender de valores enviados pelo frontend.

## Observabilidade

Eventos de uso:

- `copilot_divulgacao_solicitada`;
- `copilot_divulgacao_gerada`.

Propriedades permitidas:

- `codigo_oportunidade`;
- `categoria_oportunidade`;
- `canal_copilot`;
- `fonte_copilot`.

Prompt, texto gerado e dados de clientes não entram nos eventos de produto.

Esses eventos medem uso, não sucesso. O resultado de produto continua sendo medido por compartilhamento rastreável, visitas ao perfil, agendamentos, recorrência e receita.

## Fora de escopo

Esta V1 não inclui:

- chat livre;
- memória conversacional;
- RAG ou embeddings;
- ações autônomas;
- alteração de agenda, serviço, preço, plano ou publicação;
- leitura de dados individuais de clientes;
- decisão financeira ou de permissão pelo LLM.

A próxima expansão só deve ocorrer depois de observar uso, custo, qualidade do texto e impacto no funil real.
