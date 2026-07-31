jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
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
  }
);
