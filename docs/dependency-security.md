# Segurança de dependências

O Agenda Fashion trata dependências de runtime e ferramentas de build/teste como superfícies diferentes, mas ambas devem ser verificadas antes de integração e deploy.

## Gate obrigatório de CI

O workflow principal executa três audits com severidade mínima `high`:

- backend + tooling de teste: `npm audit --audit-level=high`;
- backend/runtime: `npm audit --omit=dev --audit-level=high`;
- frontend, incluindo tooling de build e teste: `npm --prefix frontend audit --audit-level=high`.

O audit completo da raiz impede que vulnerabilidades `high` ou `critical` em Jest e outras ferramentas do backend passem pelo CI. O audit com `--omit=dev` continua separado para manter um sinal explícito sobre o grafo efetivamente usado em produção.

Uma vulnerabilidade `high` ou `critical` em qualquer um desses grafos bloqueia o gate até que seja corrigida ou tecnicamente reavaliada com evidência suficiente. O AF não reduz severidade nem adiciona ignore apenas para liberar CI.

## Remediações transitivas

Quando o pacote vulnerável for transitivo, a preferência é manter a menor mudança compatível no lockfile, dentro do range já aceito pelo pacote pai. Atualizações maiores ou overrides permanentes só devem ser usados quando a resolução transitiva normal não for suficiente.

Toda remediação deve:

1. identificar o advisory e a faixa afetada;
2. confirmar a primeira versão corrigida em fonte confiável;
3. preservar o menor diff possível;
4. validar `npm ci` e os audits aplicáveis;
5. executar os testes proporcionais ao risco;
6. revisar o diff antes de merge/deploy.

## Remediação de setembro de 2026

O frontend utilizava `nanoid@3.3.16` de forma transitiva via PostCSS/Vite. O advisory `GHSA-2v37-7h3g-55p8` / `CVE-2026-67213` afeta a linha 3.x abaixo de `3.3.18`. A resolução foi atualizada para `nanoid@3.3.18`, sem alterar o range do PostCSS nem introduzir dependência direta desnecessária.

## Remediação adicional de setembro de 2026

Uma revisão do grafo raiz identificou advisories transitivos que não apareciam no gate de runtime porque estavam concentrados em tooling, além de findings de menor severidade no grafo do Express. A remediação preservou as majors e os ranges já aceitos pelos pacotes pais: `body-parser@2.3.0`, `qs@6.16.0`, `side-channel@1.1.1`, `brace-expansion@5.0.9/2.1.4/1.1.18`, `fast-uri@3.1.7`, `js-yaml@4.3.1/3.15.1` e `browserslist@4.28.7`. Não foram adicionados ignores nem upgrades forçados de major.

O CI também passou a auditar o grafo completo da raiz com severidade mínima `high`, mantendo em paralelo o audit exclusivo de runtime e o audit do frontend.
