# Produto do Agenda Fashion

> Estado revisado contra a `main` em 26 de agosto de 2026.

## Objetivo

O Agenda Fashion e um SaaS/marketplace brasileiro de descoberta e agendamento para beleza e estetica. O produto deve conectar clientes a profissionais e negocios, permitir descoberta de servicos e concluir agendamentos sem depender de atendimento manual para cada marcacao.

## Entidades

As analises e eventos devem diferenciar:

- **usuario/conta**: identidade autenticada. No cadastro inicial a conta nao e classificada automaticamente como cliente, dona ou profissional; os papeis surgem pelos vinculos e pelo uso;
- **profissional**: pessoa vinculada ao negocio que pode prestar servicos;
- **negocio**: unidade comercial/perfil publico com servicos, profissionais, agenda, plano e configuracoes;
- **cliente final**: pessoa que descobre e agenda servicos, com conta ou como visitante quando o fluxo permitir.

Nao trate essas entidades como sinonimos em relatorios ou regras de negocio.

## Jornada de oferta

O lado de oferta do marketplace segue, em termos de produto:

`conta -> negocio -> perfil -> servico ativo -> publicacao -> disponibilidade -> agendamentos`

O codigo atual possui camadas para negocio, servicos, profissionais, configuracao de agenda, disponibilidade e agendamentos.

### Publicacao automatica

A regra atual de sincronizacao publica o negocio quando existem:

1. especialidade em `areas` ou `setor`;
2. WhatsApp preenchido;
3. cidade;
4. estado brasileiro valido;
5. pelo menos um servico ativo.

A **descricao e opcional** e a **configuracao da agenda nao faz parte da elegibilidade de publicacao**.

Historico importante: a migration `043_publicacao_automatica_perfil_servico.sql` continha descricao no recorte de backfill. A migration `047_publicacao_sem_descricao_obrigatoria.sql` corrigiu essa regra, e a funcao atual `servicosRepository.sincronizarPublicacaoAutomatica` confirma os requisitos acima. Ao analisar comportamento atual, nao use a migration `043` isoladamente.

Se o negocio ficar sem servico ativo, o codigo possui rotina para despublica-lo.

## Descoberta

O catalogo publico atual filtra negocios `ativos` e `publicados`, aceita busca, categoria, cidade e estado, e retorna servicos ativos associados. A lista de localidades publicas so considera negocios publicados com pelo menos um servico ativo.

O perfil publico por slug retorna negocio, servicos e profissionais. Slugs antigos podem resolver para o slug atual, preservando links publicos apos mudancas.

A home e as superficies de descoberta devem facilitar exploracao do catalogo com hierarquia simples. A referencia a servicos de streaming e um principio de navegacao e descoberta, nao autorizacao para copiar identidade ou componentes de outra marca.

## Agendamento

O produto possui fluxos de agenda publica, agenda autenticada, disponibilidade e agendamento publico. A confiabilidade de horario e a ausencia de conflitos sao requisitos centrais: mudancas em disponibilidade ou criacao de agendamento devem ser avaliadas junto de banco, transacoes, limites e testes.

O WhatsApp complementa a jornada com avisos e lembretes. Ele nao deve ser requisito para uma cliente concluir manualmente cada agendamento.

## Plano gratuito e capacidade

O plano Grátis e oferta real. Ele deve permitir que o negocio experimente valor antes de upgrade. Limites e regras comerciais detalhadas ficam em `docs/planos.md`.

## Principios duraveis

- confiabilidade do agendamento vem antes de crescimento superficial;
- privacidade e isolamento entre negocios sao requisitos de produto;
- o perfil publico e um ativo de aquisicao e deve permanecer compartilhavel;
- estados de carregamento, vazio, erro, sucesso e sessao expirada fazem parte do fluxo;
- mobile e WebKit devem ser considerados nas jornadas criticas;
- melhoria de produto nao justifica regressao conhecida;
- qualquer afirmacao sobre uma funcionalidade especifica deve ser confirmada no codigo atual.

## Referencias tecnicas

- criacao e validacao de negocio: `src/services/negocioService.js`;
- publicacao automatica: `src/repositories/servicosRepository.js`;
- catalogo e perfil publico: `src/services/perfilNegocioService.js` e `src/repositories/perfilNegocioRepository.js`;
- publicacao sem descricao obrigatoria: `database/migrations/047_publicacao_sem_descricao_obrigatoria.sql`;
- slugs antigos: `database/migrations/029_slugs_antigos_negocios.sql`;
- agenda e disponibilidade: `src/services/agendaService.js`, `src/services/agendaDisponibilidadeService.js` e `src/services/agendamentoPublicoService.js`;
- planos: `docs/planos.md`.