# Arquitetura do Copilot AF

Este documento registra a camada permanente do Copilot do Agenda Fashion.

## Princípios

- O motor determinístico de ativação continua sendo a autoridade para serviço ativo, agenda confirmada, publicação e primeiro agendamento.
- A inteligência de crescimento continua responsável por transformar métricas agregadas em oportunidades priorizadas.
- O LLM é uma camada opcional de linguagem e geração; nunca substitui regras canônicas, autorização, preços, limites de plano, disponibilidade ou regras financeiras.
- O contexto enviado ao provedor deve ser mínimo e agregado, sem dados de clientes, telefones, e-mails, atendimentos individuais, tokens, segredos ou prompt livre vindo do frontend.
- O frontend não envia `negocio_id`; o backend resolve o negócio a partir do usuário autenticado e recalcula a oportunidade elegível antes de chamar o provedor.
- A integração deve ser fail-soft: indisponibilidade, timeout ou saída inválida do provedor usa fallback determinístico e não bloqueia o dashboard nem o compartilhamento.
- O texto gerado é sempre revisável/editável pela profissional antes do compartilhamento.
- Compartilhamento continua reutilizando os links rastreáveis oficiais do AF.

## Fluxo V1

```text
dashboard autorizado
  -> ativação canônica
  -> inteligência de crescimento
  -> oportunidade COMPARTILHAR_PERFIL
  -> contexto seguro agregado
  -> provider opcional de IA
  -> validação de saída
  -> fallback quando necessário
  -> texto editável
  -> compartilhamento rastreável
```

## Integração externa

A implementação V1 usa a OpenAI Responses API por HTTPS, com Structured Outputs via `json_schema`, `store: false`, timeout e limite de tokens. A feature é desligada por padrão e só usa a API quando `COPILOT_AI_ENABLED=true` e `OPENAI_API_KEY` está configurada no backend.

Nenhuma credencial do provedor pode ser exposta em `VITE_*`, frontend, logs ou eventos de analytics.

## Observabilidade

Os eventos do Copilot registram apenas metadados operacionais permitidos, como oportunidade, canal e fonte (`openai` ou `fallback`). Prompt, texto gerado e dados pessoais não são persistidos nesses eventos.

O sucesso continua sendo medido pelo funil real: compartilhamento -> visita -> agendamento iniciado -> agendamento concluído -> recorrência/receita, e não pela simples geração de texto.
