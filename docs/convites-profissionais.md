# Convite de profissionais

> **Papel documental:** documento especializado de convite, aceite, capacidade de plano, ativação e inativação de profissionais na equipe.

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

## Inativação manual e reativação

A dona pode usar `POST /profissionais/:id/inativar` para pausar uma profissional
ativa do próprio negócio, inclusive com reservas pendentes. O vínculo permanece
com o mesmo `id`, `created_at` e `ativado_em`; serviços habilitados, configuração,
reservas e histórico também permanecem. A migration 116 admite o motivo
`inativado_pela_dona`. A ação não altera papel, status ou responsável das reservas.
Repetir a ação não reescreve o motivo de um vínculo já inativo.

O backend revalida conta, vínculo de dona e negócio ativos dentro da transação;
a dona não pode inativar a si mesma. Ativação e inativação seguem a ordem
`conta da dona → capacidade → vínculos`, com a mesma conexão transacional.
A conta usa `FOR NO KEY UPDATE`, compatível com a validação `KEY SHARE` das FKs
de ator e convite, mas conflitante com a desativação/remoção da conta. Assim,
convites e outros registros com referência à dona podem concluir sem criar um
ciclo de espera com a inativação. O lock de capacidade serializa alterações da
equipe e o lock do vínculo é o mesmo exigido pelo trigger de novas reservas.
A profissional inativa não consome vaga nem recebe novos agendamentos.

Reservas próprias existentes seguem a RN50 de `docs/ciclo-atendimento.md`:
consulta e registro de realizado/falta conforme o relógio, sem workspace,
cancelamento ou reagendamento. A dona administra cancelamentos e reagendamentos
durante a pausa. Remover continua sendo uma ação distinta, sujeita à RN45.

`POST /profissionais/:id/ativar` também aceita `inativado_pela_dona`, sob os mesmos
guards de capacidade, conta/negócio ativos e ausência de vínculo profissional
ativo em outro negócio. Upgrade não reativa automaticamente. Um convite pendente
antigo retorna `409 VINCULO_INATIVADO_PELA_DONA` quando tentado durante essa pausa;
a conta convidada não pode reativar o vínculo por esse caminho.

Vínculos inativos por `inativado_pela_dona` ou `excedente_limite_plano` não
recebem novo convite. O envio retorna `409 VINCULO_PROFISSIONAL_INATIVO` antes
de persistir um convite e orienta usar `Ativar profissional` na equipe. A espera
de vaga mantém a validação específica existente. Isso evita confirmar um convite
que o guard de pausa recusaria no aceite.

### Fatos de inativação e reativação

Cada transição real registra `business_professional_deactivated` ou
`business_professional_reactivated` em `analytics_eventos`, com `origem=backend`,
UUID, instante e propriedades `business_id`, `professional_id`, `actor_type` e
`actor_id`. Inativação inclui `reason` quando disponível. A ação da dona usa
`OWNER`; aceite válido que reativa um vínculo legado usa `PROFESSIONAL`;
downgrade automático usa `SYSTEM`, com `actor_id` nulo.

O evento usa o mesmo executor transacional da mudança. Falha de persistência
do fato desfaz a transição; repetição sem mudança de estado não gera evento.
Não são emitidos fatos retroativos para vínculos já inativos ou ativos.
Os eventos não transportam contato da conta ou da cliente e não ampliam os
nomes de eventos aceitos pelo endpoint de telemetria do navegador.

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
- `POST /profissionais/:id/ativar` para a dona reativar um vínculo preservado
  por capacidade ou pausa manual
- `POST /profissionais/:id/inativar` para a dona pausar uma profissional ativa

## Frontend e UX

A dona usa `Equipe > Profissionais` para localizar uma conta por e-mail ou
WhatsApp e enviar um convite. A interface não comunica vínculo imediato e não
recarrega a equipe como se a pessoa já tivesse entrado.

A conta convidada acessa `/convites`, inclusive quando ainda não possui negócio.
A tela apresenta convites pendentes próprios, com ações `Aceitar convite` e
`Recusar`. Quando um aceite fica aguardando capacidade, esse estado permanece
visível na mesma tela, sem botões de resposta e sem atalho para o workspace,
até que a dona ative ou remova o vínculo.

Após aceite com vaga, o frontend atualiza `/minha-sessao` antes de liberar o
atalho para a área profissional. Quando o aceite fica aguardando vaga, a tela
confirma a resposta, remove o convite da lista pendente e não libera workspace.

Em `Equipe > Profissionais`, vínculos aguardando capacidade aparecem com o estado
`Aceitou o convite · aguardando vaga no plano`, ação explícita
`Ativar profissional` e acesso à gestão de assinatura. A ativação não é
automática após upgrade: a dona escolhe qual profissional ocupará a vaga, e o
backend revalida todas as regras no momento da ação.

Estados de carregamento, vazio, erro de leitura, erro de ação e sucesso são
tratados explicitamente. A inativação exige confirmação e informa o destino das
reservas; a dona não recebe essa ação no próprio cartão. Pausa manual aparece
como `Inativa por escolha da dona`, sem contar como espera de vaga no plano.

As leituras da equipe e da oferta auxiliar de plano pertencem à geração atual.
Nova leitura, alteração ou saída invalida respostas anteriores. Uma alteração
por vez fica disponível, incluindo a atualização posterior; PUT de serviços e
alterações da equipe também não podem se sobrepor. Respostas confirmadas de
ativação/inativação atualizam imediatamente o cartão. Se o GET seguinte falhar,
a interface conserva esse fato e exige `Atualizar equipe`, que só faz GET.
Resultado de escrita incerto fecha a confirmação e também exige consulta antes
de repetir; erros de validação mantêm a confirmação para correção.

O menu autenticado mantém `Convites de equipe` acessível tanto antes quanto
depois do vínculo.

## Edição dos serviços por profissional

Cada abertura de `Configurar serviços` inicia uma leitura vinculada à pessoa e
àquela abertura da janela. Fechar por botão ou Escape, trocar de profissional e
sair da página cancelam/inutilizam a leitura anterior. Sucesso, erro e conclusão
de uma leitura antiga não podem alterar opções, erro ou carregamento atuais,
mesmo que o transporte entregue a resposta depois do cancelamento.

O salvamento usa somente a pessoa e as opções da leitura atual concluída;
não fica disponível durante o carregamento ou após erro de leitura. Durante o
PUT, a janela mantém o contexto e impede envio duplicado. Falha ao salvar
preserva a seleção e permite nova tentativa; sucesso libera a próxima edição.
A autorização e a elegibilidade continuam sendo revalidadas no backend.
