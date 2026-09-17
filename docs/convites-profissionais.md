# Convite de profissionais

## Regra permanente

O Agenda Fashion não cria vínculo `profissional` a partir do simples conhecimento
do e-mail ou WhatsApp da conta.

O fluxo é:

1. a dona autenticada informa o e-mail ou WhatsApp exato;
2. o backend cria `convites_profissionais` com status `pendente`;
3. o profissional autenticado visualiza os próprios convites;
4. somente o usuário convidado pode aceitar ou recusar;
5. o vínculo em `usuarios_negocios` é criado dentro da transação de aceite;
6. o aceite revalida negócio/usuário ativos, limite atual do plano e vínculo
   profissional ativo em outro negócio.

Convites expiram em 7 dias.

## Privacidade

A busca interna pelo identificador nunca deve devolver o contato alternativo.
Conhecer o e-mail não autoriza revelar o WhatsApp, e conhecer o WhatsApp não
autoriza revelar o e-mail.

A resposta de criação do convite pode conter apenas os dados mínimos necessários
para confirmação visual: `id`, `nome` e `foto_url`.

## Compatibilidade

`POST /profissionais/vincular` permanece temporariamente como alias de criação de
convite. Ele não pode criar `usuarios_negocios` diretamente.

Novas integrações devem usar:

- `POST /profissionais/convites`
- `GET /profissionais/convites/recebidos`
- `POST /profissionais/convites/:id/aceitar`
- `POST /profissionais/convites/:id/recusar`

## Frontend e UX

A dona usa `Equipe > Profissionais` para localizar uma conta por e-mail ou
WhatsApp e enviar um convite. A interface não comunica vínculo imediato e não
recarrega a equipe como se a pessoa já tivesse entrado.

A conta convidada acessa `/convites`, inclusive quando ainda não possui negócio.
A tela apresenta apenas convites pendentes próprios, com ações `Aceitar convite`
e `Recusar`.

Após aceite, o frontend atualiza `/minha-sessao` antes de liberar o atalho para
a área profissional. Estados de carregamento, vazio, erro de leitura, erro de
ação e sucesso são tratados explicitamente.

O menu autenticado mantém `Convites de equipe` acessível tanto antes quanto
depois do vínculo.
