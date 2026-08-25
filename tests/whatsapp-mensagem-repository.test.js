jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
    executarTransacao:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);

describe(
  "Repositório da fila do WhatsApp",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "enfileira lembrete da profissional com as seis variáveis aprovadas",
      async () => {
        const executor = {
          query: jest.fn().mockResolvedValue({
            rows: [],
          }),
        };

        await whatsappMensagemRepository
          .enfileirarNovoAgendamento(
            executor,
            99,
            24,
            true
          );

        const consulta = executor.query.mock
          .calls[0][0]
          .replace(/\s+/g, " ");

        expect(consulta).toContain(
          "'LEMBRETE_AGENDAMENTO_PROFISSIONAL'"
        );
        expect(consulta).toContain(
          "AND $3::BOOLEAN"
        );
        expect(consulta).toContain(
          "profissional.whatsapp_operacional_consentido_em"
        );
        expect(consulta).toContain(
          "AND profissional_whatsapp_consentido"
        );
        expect(consulta).toContain(
          "JSONB_BUILD_ARRAY( profissional_nome, cliente_nome, cliente_whatsapp, servico_nome, data_formatada, horario_formatado )"
        );
      }
    );

    test(
      "enfileira cancelamento do profissional com as seis variáveis do template",
      async () => {
        const executor = {
          query: jest
            .fn()
            .mockResolvedValueOnce({
              rows: [],
            })
            .mockResolvedValueOnce({
              rows: [],
            }),
        };

        await whatsappMensagemRepository
          .enfileirarCancelamento(
            executor,
            99
          );

        const consultaInsercao =
          executor.query.mock
            .calls[1][0]
            .replace(
              /\s+/g,
              " "
            );

        expect(
          consultaInsercao
        ).toContain(
          "profissional.nome AS profissional_nome"
        );

        expect(
  consultaInsercao
).toContain(
  "JSONB_BUILD_ARRAY( profissional_nome, cliente_nome, cliente_whatsapp, servico_nome, data_formatada, horario_formatado ) AS parametros_corpo"
);
      }
    );

    test(
      "cria lembretes diários exclusivos e idempotentes por negócio",
      async () => {
        db.query.mockResolvedValue({
          rows: [],
        });

        await whatsappMensagemRepository
          .enfileirarLembretesDiariosNegocios(
            10,
            true,
            true
          );

        const [consulta, parametros] =
          db.query.mock.calls[0];
        const sql = consulta.replace(/\s+/g, " ");

        expect(sql).toContain(
          "LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO"
        );
        expect(sql).toContain(
          "LEMBRETE_DIVULGAR_NEGOCIO"
        );
        expect(sql).toContain(
          "whatsapp_marketing_consentido_em IS NOT NULL"
        );
        expect(sql).toContain(
          "ON CONFLICT ( negocio_id, data_referencia )"
        );
        expect(sql).toContain(
          "COUNT(*) FROM whatsapp_mensagens historico"
        );
        expect(sql).toContain(
          "candidata.data_referencia - $5::INTEGER"
        );
        expect(parametros).toEqual([
          10,
          true,
          true,
          3,
          3,
        ]);
      }
    );

    test(
      "encerra as tentativas de uma falha permanente",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              id: 10,
            },
          ],
        });

        await whatsappMensagemRepository
          .marcarFalha(
            {
              id: 10,
              tentativas: 1,
              max_tentativas: 5,
            },
            "Template inválido.",
            60,
            false
          );

        const [
          consulta,
          parametros,
        ] =
          db.query.mock.calls[0];

        expect(
          consulta
        ).toContain(
          "ELSE max_tentativas"
        );

        expect(
          parametros
        ).toEqual([
          10,
          "Template inválido.",
          true,
          60,
          false,
        ]);
      }
    );

    test(
      "bloqueia opt-out global antes de reservar uma mensagem da cliente",
      async () => {
        db.query.mockResolvedValue({
          rows: [],
        });

        await whatsappMensagemRepository
          .reservarProximaMensagem();

        const [consulta] =
          db.query.mock.calls[0];
        const sql = consulta.replace(
          /\s+/g,
          " "
        );

        expect(sql).toContain(
          "a.whatsapp_consentido_em IS NOT NULL"
        );
        expect(sql).toContain(
          "FROM whatsapp_interacoes_recebidas optout"
        );
        expect(sql).toContain(
          "optout.recebido_em >= a.whatsapp_consentido_em"
        );
      }
    );

    test(
      "revalida a autorização da conta do cliente antes do envio",
      async () => {
        db.query.mockResolvedValue({
          rows: [{ valida: true }],
        });

        await whatsappMensagemRepository
          .mensagemContinuaValida(10);

        const [consulta, parametros] =
          db.query.mock.calls[0];
        const sql = consulta.replace(/\s+/g, " ");

        expect(sql).toContain(
          "cliente_conta.whatsapp_notificacoes_consentido_em IS NOT NULL"
        );
        expect(sql).toContain(
          "a.whatsapp_consentido_em IS NOT NULL"
        );
        expect(sql).toContain(
          "cliente_conta.whatsapp_notificacoes_cancelado_em IS NULL"
        );
        expect(sql).toContain(
          "REGEXP_REPLACE( cliente_conta.whatsapp, '[^0-9]', '', 'g' ) = CASE"
        );
        expect(sql).toContain(
          "wm.destinatario"
        );
        expect(sql).toContain(
          "FROM whatsapp_interacoes_recebidas optout"
        );
        expect(sql).toContain(
          "optout.recebido_em >= a.whatsapp_consentido_em"
        );
        expect(parametros[5]).toEqual(
          expect.arrayContaining([
            "CONFIRMACAO_AGENDAMENTO_CLIENTE",
            "LEMBRETE_AGENDAMENTO_CLIENTE",
            "CANCELAMENTO_AGENDAMENTO_CLIENTE",
          ])
        );
      }
    );

    test(
      "cancela a preferência e a fila de marketing",
      async () => {
        const executor = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [
                {
                  id: 7,
                  whatsapp:
                    "62999998888",
                },
              ],
              rowCount: 1,
            })
            .mockResolvedValueOnce({
              rows: [],
              rowCount: 1,
            })
            .mockResolvedValueOnce({
              rows: [
                { id: 50 },
              ],
              rowCount: 1,
            }),
        };

        db.executarTransacao
          .mockImplementation(
            async (callback) =>
              callback(executor)
          );

        const resultado =
          await whatsappMensagemRepository
            .cancelarMarketingPorWhatsapp(
              "5562999998888"
            );

        expect(resultado).toEqual({
          usuarios: 1,
          mensagensCanceladas: 1,
        });

        expect(
          executor.query.mock
            .calls[0][1]
        ).toEqual([
          "62999998888",
        ]);

        expect(
          executor.query.mock
            .calls[2][0]
        ).toContain(
          "Marketing cancelado pelo destinatário"
        );
      }
    );

    test(
      "cancela todas as preferências e mensagens no opt-out global",
      async () => {
        const executor = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [
                {
                  id: 7,
                  whatsapp:
                    "62999998888",
                  cliente_ativo: true,
                  profissional_ativo:
                    true,
                  marketing_ativo:
                    true,
                },
              ],
              rowCount: 1,
            })
            .mockResolvedValueOnce({
              rows: [],
              rowCount: 3,
            })
            .mockResolvedValueOnce({
              rows: [
                {
                  agendamento_id:
                    40,
                },
              ],
              rowCount: 1,
            })
            .mockResolvedValueOnce({
              rows: [
                { id: 50 },
                { id: 51 },
              ],
              rowCount: 2,
            }),
        };

        db.executarTransacao
          .mockImplementation(
            async (callback) =>
              callback(executor)
          );

        const resultado =
          await whatsappMensagemRepository
            .cancelarTodasComunicacoesPorWhatsapp(
              "5562999998888"
            );

        expect(resultado).toEqual({
          usuarios: 1,
          agendamentos: 1,
          mensagensCanceladas: 2,
        });

        const consultaUsuario =
          executor.query.mock
            .calls[0][0];

        expect(consultaUsuario).toContain(
          "whatsapp_notificacoes_cancelado_em"
        );
        expect(consultaUsuario).toContain(
          "whatsapp_operacional_cancelado_em"
        );
        expect(consultaUsuario).toContain(
          "whatsapp_marketing_cancelado_em"
        );

        const consultaAuditoria =
          executor.query.mock
            .calls[1][0];

        expect(consultaAuditoria).toContain(
          "OPERACIONAL_CLIENTE"
        );
        expect(consultaAuditoria).toContain(
          "OPERACIONAL_PROFISSIONAL"
        );
        expect(consultaAuditoria).toContain(
          "MARKETING_PROFISSIONAL"
        );
        expect(consultaAuditoria).toContain(
          "optout-global-whatsapp-v1"
        );

        const consultaAgendamentos =
          executor.query.mock
            .calls[2][0];

        expect(
          consultaAgendamentos
        ).toContain(
          "whatsapp_consentido_em = NULL"
        );
        expect(
          consultaAgendamentos
        ).toContain(
          "optout-global-agendamento-v1"
        );

        const consultaFila =
          executor.query.mock
            .calls[3][0];

        expect(consultaFila).toContain(
          "Mensagens canceladas pelo destinatário"
        );
        expect(consultaFila).not.toContain(
          "tipo = ANY"
        );
      }
    );

    test(
      "registra status de entrega usando o wamid",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              id: 10,
              status_entrega:
                "DELIVERED",
            },
          ],
        });

        const ocorridoEm =
          new Date(
            "2026-07-29T15:00:00Z"
          );

        await whatsappMensagemRepository
          .registrarStatusEntrega({
            metaMessageId:
              "wamid.teste",
            status:
              "delivered",
            ocorridoEm,
          });

        const [
          consulta,
          parametros,
        ] =
          db.query.mock.calls[0];

        expect(
          consulta
        ).toContain(
          "WHERE meta_message_id = $1"
        );

        expect(
          parametros.slice(
            0,
            3
          )
        ).toEqual([
          "wamid.teste",
          "DELIVERED",
          ocorridoEm,
        ]);
      }
    );

    test(
      "registra a mensagem recebida de forma idempotente pelo wamid",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              id: 70,
            },
          ],
        });

        const recebidoEm =
          new Date(
            "2026-08-24T23:00:00Z"
          );

        await whatsappMensagemRepository
          .registrarInteracaoRecebida({
            metaMessageId:
              "wamid.quebra-gelo",
            telefone:
              "+55 (62) 99999-8888",
            intencao:
              "COMO_FUNCIONA",
            recebidoEm,
          });

        const [
          consulta,
          parametros,
        ] = db.query.mock.calls[0];

        expect(consulta).toContain(
          "ON CONFLICT"
        );
        expect(consulta).toContain(
          "meta_message_id"
        );
        expect(parametros).toEqual([
          "wamid.quebra-gelo",
          "5562999998888",
          "COMO_FUNCIONA",
          recebidoEm,
        ]);
      }
    );

    test(
      "marca a interação com o wamid da resposta",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              id: 70,
              status:
                "RESPONDIDA",
            },
          ],
        });

        await whatsappMensagemRepository
          .marcarInteracaoRespondida(
            70,
            "wamid.resposta"
          );

        const [
          consulta,
          parametros,
        ] = db.query.mock.calls[0];

        expect(consulta).toContain(
          "status = 'RESPONDIDA'"
        );
        expect(parametros).toEqual([
          70,
          "wamid.resposta",
        ]);
      }
    );
  }
);
