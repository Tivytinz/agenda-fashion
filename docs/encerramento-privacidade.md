# Encerramento e privacidade

> **Papel documental:** fonte canônica para encerramento lógico de conta, arquivamento de negócio e preservação operacional dos dados necessários.

Este documento registra o comportamento operacional dos critérios P0 de
privacidade e encerramento da baseline v1.16.

## Negócio ARQUIVADO

O encerramento voluntário é feito pela proprietária autenticada.
`POST /negocio/encerrar` exige `{ negocio_id }`, correspondente ao negócio
carregado em Meu negócio. O ID seleciona o alvo; o backend valida propriedade,
conta, vínculo e estado persistidos dentro da transação. Pedido sem alvo válido
retorna `400 NEGOCIO_ALVO_OBRIGATORIO`, inclusive para bundles antigos, sem
escolher silenciosamente o negócio operacional atual.

A conta é bloqueada antes do negócio e do vínculo. Uma repetição para um alvo
já arquivado pela mesma dona devolve o arquivamento canônico sem reexecutar
efeitos nem alterar timestamps. Essa leitura exige propriedade histórica e
`arquivado_por` correspondente; a referência não concede acesso a outra conta.
Criar outro negócio depois não muda o alvo da tentativa anterior.

Antes do arquivamento, a mesma transação revalida:

- ausência de agendamentos operacionais em `agendado` ou `confirmado`;
- ausência de assinatura paga ainda ativa;
- ausência de checkout pendente/processando;
- ausência de operação financeira pendente suportada pelo schema atual.

Tentativas externas de renovação em `PENDING` ou `REMOVING` também são pendências,
mesmo após estorno, suspensão ou fim do acesso. Arquivar o negócio não pode
tornar uma recorrência criada invisível à recuperação do worker.

Se existir pendência, a API responde `409 ENCERRAMENTO_COM_PENDENCIAS` e
retorna categorias seguras e acionáveis. O frontend deve mostrar essas
pendências em vez de esconder o erro.

Quando as condições são satisfeitas:

- `negocios.ativo = FALSE`;
- `negocios.publicado = FALSE`;
- `arquivado_em`, `arquivado_por` e `motivo_arquivamento` são persistidos;
- vínculos ativos da equipe em `usuarios_negocios` são desativados para não
  manter acesso nem bloquear a profissional em outro negócio;
- convites ainda `pendente` passam para `cancelado`;
- serviços, vínculos, agendamentos, pagamentos e referências históricas não são
  apagados;
- o negócio deixa de aparecer na descoberta e de conceder contexto operacional;
- o negócio arquivado não conta como negócio próprio operacional da conta;
- consultas usadas para limitar propriedade exigem vínculo de dona ativo, negócio
  ativo e `arquivado_em IS NULL`;
- depois do arquivamento seguro, a mesma conta pode criar um novo negócio próprio
  operacional sem que o histórico antigo seja apagado;
- não existe rota normal de reativação de negócio arquivado.

Depois da resposta de arquivamento, o frontend retira o negócio do contexto
local, conserva a identidade autenticada e outros vínculos, e conclui a
navegação de sucesso. A atualização de sessão é silenciosa e auxiliar. Sua
lentidão ou falha não deve reapresentar o encerramento como malsucedido nem
oferecer a repetição do POST já confirmado. Leituras de sessão anteriores ao
arquivamento são invalidadas para não restaurar o vínculo encerrado.
Se a resposta principal for perdida, `Verificar encerramento` repete somente o
mesmo alvo explícito. As demais edições ficam protegidas até confirmar o estado;
pendências confirmadas permitem resolver o negócio ainda operacional.

## Conta profissional e proprietária

Encerramento definitivo é lógico, não um `DELETE` físico da linha de
`usuarios`, porque FKs, histórico, segurança, auditoria e obrigações de
retenção podem exigir a referência original.

A operação marca:

- `usuarios.ativo = FALSE`;
- `desativado_em`;
- `encerrado_definitivo_em`.

Uma profissional não proprietária não pode encerrar definitivamente a conta
enquanto possuir agendamento operacional atribuído.

Quando uma proprietária solicita encerramento definitivo, o backend tenta
arquivar o negócio na mesma transação. Qualquer pendência que bloquearia o
encerramento voluntário também bloqueia a conta inteira. Não existe transferência
de propriedade automática.

## Cliente com reserva ativa

Uma conta usada como cliente pode ser desativada sem cancelar automaticamente
suas reservas.

O `Client` interno e os dados mínimos do booking permanecem preservados. Para
cada reserva ainda operacional, a resposta da desativação entrega um acesso
específico ao booking.

A credencial:

- é HMAC-SHA256 derivada de booking, usuário e instante da desativação;
- novas capabilities usam `BOOKING_CAPABILITY_SECRET`, separado da sessão;
- durante a migração/rotação, a validação pode aceitar
  `BOOKING_CAPABILITY_PREVIOUS_SECRET`; para preservar links emitidos antes da
  separação, essa variável deve receber explicitamente o valor anterior de
  `JWT_SECRET` e ser removida quando a janela de compatibilidade aprovada
  terminar;
- não é aceita na query da API;
- fica no fragmento `#token=` do link entregue ao navegador;
- é repassada para consulta pelo header `X-Agenda-Access`;
- é repassada no corpo para cancelamento;
- só funciona quando a conta original está inativa;
- não substitui a regra de cutoff do booking.

A rota pública de consulta expõe somente os dados mínimos da própria reserva.
O cancelamento reutiliza a política congelada no agendamento e continua
transacional.

Consulta e cancelamento por capability, inclusive os caminhos de visitante,
enviam `Cache-Control: no-store` tanto no sucesso quanto no erro. Informar
`?token=` sem a credencial no transporte autorizado não concede acesso.

## Retenção depois do encerramento

Encerramento definitivo é um estado operacional terminal, não uma promessa de
apagamento imediato de todas as linhas relacionadas. O backend deve preservar
somente dados com finalidade documentada de histórico, segurança, auditoria,
defesa de direitos ou obrigação aplicável.

A implementação atual ainda não possui um prazo geral aprovado para anonimizar
PII de contas encerradas. Por isso:

- o produto não deve afirmar que nome, e-mail ou WhatsApp são apagados
  imediatamente pelo `DELETE /conta`;
- nenhum job automático de anonimização deve adotar prazo arbitrário;
- antes de automatizar a etapa final, é necessário aprovar uma matriz de
  retenção por categoria de dado e provar que bookings, pagamentos, auditoria e
  obrigações de defesa permanecem íntegros;
- quando a política for aprovada, a execução deve ser idempotente, auditável e
  coberta por testes antes de rodar em produção.

A política pública deve continuar dizendo que dados são eliminados ou
anonimizados quando possível e após deixarem de ser necessários; esse texto não
substitui a definição operacional dos prazos.

## Rotas

- `POST /negocio/encerrar` — encerramento voluntário do negócio;
- `POST /conta/desativar` — desativação da conta, preservando reservas de
  cliente;
- `DELETE /conta` — encerramento definitivo da identidade operacional;
- `GET /agendamentos/:id/acesso-cliente-desativado` — consulta mínima por
  credencial;
- `PATCH /agendamentos/:id/cancelar-acesso-cliente-desativado` — cancelamento
  por credencial, sujeito ao cutoff.

## Banco

A migration `087_encerramento_privacidade.sql` adiciona somente estado
explícito e auditável. Nenhuma migration aplicada é reescrita.

## Critérios P0

- CA-PRV-01: pendências bloqueiam encerramento;
- CA-PRV-02: arquivamento encerra operação sem apagar histórico;
- CA-PRV-03: negócio arquivado não conta no limite de propriedade e a mesma
  conta pode criar outro negócio operacional;
- CA-PRV-04: profissional com reserva confirmada não encerra definitivamente a
  conta;
- CA-PRV-05: cliente pode desativar conta sem perder a reserva;
- CA-PRV-06: proprietária só encerra conta após arquivamento seguro do negócio.
