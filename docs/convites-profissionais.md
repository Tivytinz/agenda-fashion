# Convite de profissionais

## Regra permanente

O Agenda Fashion não cria vínculo `profissional` a partir do simples conhecimento
do e-mail ou WhatsApp da conta.

O fluxo é:

1. a dona autenticada informa o e-mail ou WhatsApp exato;
2. o backend cria `convites_profissionais` com status `pendente`;
3. o profissional autenticado visualiza os próprios convites;
4. somente o usuário convidado pode aceitar ou recusar;
5. o aceite revalida negócio/usuário ativos, vínculo profissional ativo em outro
   negócio e capacidade atual do plano;
6. com vaga disponível, o vínculo em `usuarios_negocios` é criado ou reativado
   como ativo na mesma transação;
7. sem vaga disponível, o convite é aceito e o vínculo é persistido como
   `ativo = FALSE` com `motivo_inatividade = 'aguardando_vaga_plano'`;
8. vínculo aguardando vaga não concede workspace profissional, não recebe novos
   agendamentos, não participa da elegibilidade profissional-serviço e não
   consome `limite_profissionais`;
9. a dona visualiza o vínculo aguardando vaga e decide quando ativá-lo;
10. a ativação revalida capacidade do plano, negócio/conta ativos e ausência de
    outro vínculo profissional ativo antes de marcar o vínculo como ativo.

Convites expiram em 7 dias. Aceitar sem capacidade não deixa o convite pendente:
a intenção da profissional é persistida e a limitação passa a ser tratada pelo
negócio.

## Privacidade

A busca interna pelo identificador nunca deve devolver o contato alternativo.
Conhecer o e-mail não autoriza revelar o WhatsApp, e conhecer o WhatsApp não
autoriza revelar o e-mail.

A resposta de criação do convite pode conter apenas os dados mínimos necessários
para confirmação visual: `id`, `nome` e `foto_url`. Enquanto o vínculo
aceito estiver aguardando vaga, a listagem da equipe também não deve revelar o
contato alternativo da conta; o WhatsApp só volta a ser exposto no contexto
operacional depois da ativação do vínculo.

## Compatibilidade

`POST /profissionais/vincular` permanece temporariamente como alias de criação de
convite. Ele não pode criar `usuarios_negocios` diretamente.

Novas integrações devem usar:

- `POST /profissionais/convites`
- `GET /profissionais/convites/recebidos`
- `POST /profissionais/convites/:id/aceitar`
- `POST /profissionais/convites/:id/recusar`
- `POST /profissionais/:id/ativar` para a dona liberar um vínculo que já
  aceitou o convite e está aguardando capacidade

## Frontend e UX

A dona usa `Equipe > Profissionais` para localizar uma conta por e-mail ou
WhatsApp e enviar um convite. A interface não comunica vínculo imediato e não
recarrega a equipe como se a pessoa já tivesse entrado.

A conta convidada acessa `/convites`, inclusive quando ainda não possui negócio.
A tela apresenta apenas convites pendentes próprios, com ações `Aceitar convite`
e `Recusar`.

Após aceite com vaga, o frontend atualiza `/minha-sessao` antes de liberar o
atalho para a área profissional. Quando o aceite fica aguardando vaga, a tela
confirma a resposta, remove o convite da lista pendente e não libera workspace.

Em `Equipe > Profissionais`, vínculos aguardando capacidade aparecem com o estado
`Aceitou o convite · aguardando vaga no plano`, ação explícita
`Ativar profissional` e acesso à gestão de assinatura. A ativação não é
automática após upgrade: a dona escolhe qual profissional ocupará a vaga, e o
backend revalida todas as regras no momento da ação.

Estados de carregamento, vazio, erro de leitura, erro de ação e sucesso são
tratados explicitamente.

O menu autenticado mantém `Convites de equipe` acessível tanto antes quanto
depois do vínculo.
