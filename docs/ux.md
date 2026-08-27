# UX e identidade do Agenda Fashion

> Diretrizes revisadas contra a `main` em 26 de agosto de 2026.

Este documento separa diretrizes aprovadas de UX da implementação atual. Quando a pergunta for se uma tela já faz algo, confirme nos componentes e testes antes de responder.

## Identidade

- Nome: Agenda Fashion (AF).
- Domínio principal: `https://app.agendafashion.com.br`.
- Paleta principal: rosa, branco e grafite suave.
- O ativo oficial de marca está em `frontend/src/assets/brand/af-logo-transparent.png`.
- Não criar substitutos de marca sem decisão explícita.

## Descoberta

A experiência pública deve facilitar explorar negócios e serviços com hierarquia clara. A referência a catálogos de streaming significa facilidade de descoberta e continuidade visual, não cópia de outra interface.

O backend atual permite filtrar negócios publicados por busca, categoria, cidade e estado. Localidades públicas são derivadas da oferta publicada com serviço ativo.

Sem localização escolhida ou autorizada, a interface não deve afirmar que resultados estão próximos nem inferir a cidade da cliente pelo primeiro negócio retornado.

## Publicação e perfil

A regra atual de publicação exige especialidade, WhatsApp, cidade, estado válido e ao menos um serviço ativo. Descrição é opcional e agenda não é requisito de publicação.

Links antigos de perfil devem continuar funcionando quando o slug mudar.

## Estados de interface

Fluxos relevantes devem tratar carregamento, vazio, erro, sucesso, sessão expirada, falta de permissão, limite de plano, ausência de disponibilidade e responsividade.

Esses estados fazem parte da funcionalidade e não são acabamento posterior.

## Mobile

O produto deve funcionar bem em telas pequenas. O CI atual executa Playwright em Chromium e WebKit, então jornadas críticas cobertas por E2E devem preservar compatibilidade com ambos.

## Dashboard

Cards e gráficos devem informar claramente entidade, período, unidade, taxa ou valor e qualidade do dado. Evitar números soltos sem contexto.

## Princípios de clareza

- controles interativos precisam parecer interativos;
- não depender só de cor para comunicar estado;
- manter contraste e leitura adequados;
- imagens devem possuir fallback coerente;
- rolagem horizontal precisa indicar continuidade;
- mensagens de erro devem explicar a próxima ação;
- reduzir fricção sem sacrificar segurança ou confiabilidade.

## Referências

- React: `frontend/src/`;
- rotas: `frontend/src/App.jsx`;
- estilos: `frontend/src/styles/`;
- componentes: `frontend/src/components/`;
- páginas: `frontend/src/pages/`;
- marca: `frontend/src/assets/brand/`;
- catálogo: `src/services/perfilNegocioService.js`;
- publicação: `src/repositories/servicosRepository.js`.