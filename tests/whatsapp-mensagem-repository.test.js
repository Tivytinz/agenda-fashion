jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
  })
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);

describe(
  "Repositório da fila do WhatsApp",
  () => {
    test(
      "enfileira cancelamento do profissional com as cinco variáveis do template",
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
          "JSONB_BUILD_ARRAY( cliente_nome, servico_nome, profissional_nome, data_formatada, horario_formatado ) AS parametros_corpo"
        );
      }
    );
  }
);
