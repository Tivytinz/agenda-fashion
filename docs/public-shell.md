# PublicShell e contexto público

O `PublicShell` formaliza a experiência pública e de cliente do Agenda Fashion dentro da mesma aplicação React usada pelos demais contextos.

## Papel arquitetural

O frontend continua sendo uma única aplicação. Os quatro contextos visuais canônicos são:

```text
público / cliente  → PublicShell
/painel/*          → OwnerShell
/profissional/*    → ProfessionalShell
/admin/*           → AdminShell
```

O shell define composição e ownership visual. Ele não concede acesso, não altera papéis e não substitui autenticação ou autorização do backend.

## Resolução do contexto público

`PublicShell` envolve a raiz do React e marca `data-frontend-context="public"` apenas quando a rota não pertence aos contextos operacionais de Admin, dona ou profissional.

Rotas `/admin/*`, `/painel/*` e `/profissional/*` são delegadas aos shells próprios. Em `/conta`, uma conta administrativa ou vinculada a negócio também é delegada ao contexto privado correspondente; uma conta somente de cliente permanece no contexto público.

Telas de entrada, descoberta, perfil público, agendamento, autenticação, favoritos, agendamentos do cliente e páginas institucionais usam a fundação pública. Fluxos de transição que ainda não possuem shell operacional específico podem continuar nessa fundação até existir benefício real em migrá-los.

## Design system

Não existem quatro bibliotecas de UI independentes. O Agenda Fashion mantém uma fundação compartilhada e tokens contextuais.

O contexto público possui tokens `--public-*` para:

- marca e ação principal;
- superfícies e fundo;
- texto e texto secundário;
- bordas;
- foco;
- raios;
- sombras.

`public-shell.css` importa `public-design-system.css` e mantém as regras novas escopadas a `.public-shell` ou `html.public-context-active`. O CSS histórico público em `index.css`, `af-experience.css`, `home-discovery.css`, `profile-polish.css` e arquivos relacionados continua válido por compatibilidade; não há reescrita ampla apenas para mudar ownership nominal.

A evolução deve migrar componentes tocados para tokens sem duplicar estilos nem quebrar páginas já estáveis.

## UX

A experiência pública é a face mais acolhedora e visual do AF. Deve priorizar:

- descoberta simples;
- perfil e oferta legíveis;
- agendamento com poucos passos;
- acesso fácil a favoritos e agendamentos do cliente;
- identidade rosa, branca e grafite;
- foco visível e navegação por teclado;
- mobile first e Safari/WebKit;
- ausência de overflow horizontal e conteúdo encoberto.

## Segurança

O `PublicShell` é exclusivamente uma decisão de apresentação. Rotas protegidas continuam usando `ProtectedRoute` e as regras server-side existentes. IDs, papéis, preços, limites, publicação e permissões não passam a ser confiados ao frontend.

## Testes

A implementação deve manter cobertura para:

- resolução pública versus os três contextos operacionais;
- `/conta` de cliente versus conta vinculada a Admin/negócio;
- marcador `data-frontend-context="public"`;
- foco visível;
- ausência de overflow mobile;
- preservação dos shells `OwnerShell`, `ProfessionalShell` e `AdminShell`.

Mudanças posteriores no contexto público devem manter esses contratos ou atualizar este documento quando a arquitetura mudar de forma deliberada.
