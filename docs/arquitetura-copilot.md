# Arquitetura do Copilot AF

> **Papel documental:** documento especializado da arquitetura do Copilot. O contrato funcional do caso de uso V1 permanece em [`copilot-v1.md`](./copilot-v1.md).

Este documento registra a camada permanente do Copilot do Agenda Fashion.

## Princípios

- O motor determinístico de ativação continua sendo a autoridade para serviço ativo, publicação e primeiro agendamento válido.
- A disponibilidade é infraestrutura operacional do agendamento e continua sob autoridade do backend, mas não é gate canônico de ativação nem de publicação.
- A inteligência de crescimento continua responsável por transformar métricas agregadas em oportunidades priorizadas.
- O caminho padrão de divulgação é determinístico e não consome tokens: a inteligência de crescimento decide a oportunidade e o AF consegue produzir o texto básico sem provedor externo.
- O LLM é uma camada opcional e experimental de linguagem; nunca é requisito para detectar `COMPARTILHAR_PERFIL` nem substitui regras canônicas, autorização, preços, limites de plano, disponibilidade ou regras financeiras.
- ML não é necessário para detectar a oportunidade de compartilhamento atual; só deve entrar em decisões futuras que exijam aprendizado estatístico e tenham amostra e avaliação adequadas.
- O contexto enviado ao provedor deve ser mínimo e agregado, sem dados de clientes, telefones, e-mails, atendimentos individuais, tokens, segredos ou prompt livre vindo do frontend.
- O frontend não envia `negocio_id`; o backend resolve o negócio a partir do usuário autenticado e recalcula a oportunidade elegível antes de chamar o provedor.
- A integração deve ser fail-soft: indisponibilidade, timeout ou saída inválida do provedor usa geração determinística e não bloqueia o dashboard nem o compartilhamento.
- O texto gerado é sempre revisável/editável pela profissional antes do compartilhamento.
- Compartilhamento continua reutilizando os links rastreáveis oficiais do AF.

## Fluxo V1

```text
dashboard autorizado
  -> ativação canônica
  -> inteligência de crescimento
  -> oportunidade COMPARTILHAR_PERFIL
  -> contexto seguro agregado
  -> texto determinístico padrão
  -> provider opcional de IA quando explicitamente habilitado
  -> validação de saída
  -> retorno ao texto determinístico quando necessário
  -> texto editável
  -> compartilhamento rastreável
```

## Integração externa

A implementação V1 mantém a OpenAI Responses API por HTTPS como opção experimental, com Structured Outputs via `json_schema`, `store: false`, timeout e limite de tokens. A feature é desligada por padrão e o fluxo normal permanece determinístico. A API só é chamada quando `COPILOT_AI_ENABLED=true` e `OPENAI_API_KEY` está configurada no backend; possuir a chave sem habilitar a flag não deve gerar consumo.

Nenhuma credencial do provedor pode ser exposta em `VITE_*`, frontend, logs ou eventos de analytics.

## Observabilidade

Os eventos do Copilot registram apenas metadados operacionais permitidos, como oportunidade, canal e fonte (`openai` ou `geração determinística`). Prompt, texto gerado e dados pessoais não são persistidos nesses eventos.

O sucesso continua sendo medido pelo funil real: compartilhamento -> visita -> agendamento iniciado -> agendamento concluído -> recorrência/receita, e não pela simples geração de texto.
