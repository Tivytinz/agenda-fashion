# Encerramento e privacidade

Este documento registra o comportamento operacional dos critérios P0 de
privacidade e encerramento da baseline v1.16.

## Negócio ARQUIVADO

O encerramento voluntário é feito pela proprietária autenticada. O backend
resolve o negócio pelo vínculo persistido da conta; nenhum identificador de
negócio enviado pelo navegador é usado como autorização.

Antes do arquivamento, a mesma transação revalida:

- ausência de agendamentos operacionais em `agendado` ou `confirmado`;
- ausência de assinatura paga ainda ativa;
- ausência de checkout pendente/processando;
- ausência de operação financeira pendente suportada pelo schema atual.

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
- não existe rota normal de reativação de negócio arquivado.

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

- é HMAC-SHA256 derivada de booking, usuário, instante da desativação e
  `JWT_SECRET`;
- não é enviada na query da API;
- fica no fragmento `#token=` do link entregue ao navegador;
- é repassada para consulta pelo header `X-Agenda-Access`;
- é repassada no corpo para cancelamento;
- só funciona quando a conta original está inativa;
- não substitui a regra de cutoff do booking.

A rota pública de consulta expõe somente os dados mínimos da própria reserva.
O cancelamento reutiliza a política congelada no agendamento e continua
transacional.

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
- CA-PRV-04: profissional com reserva confirmada não encerra definitivamente a
  conta;
- CA-PRV-05: cliente pode desativar conta sem perder a reserva;
- CA-PRV-06: proprietária só encerra conta após arquivamento seguro do negócio.
