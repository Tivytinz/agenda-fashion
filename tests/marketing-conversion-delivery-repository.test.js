const mockClient = {
  query: jest.fn()
};

jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
    executarTransacao:
      jest.fn(
        async (callback) =>
          callback(mockClient)
      )
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingConversionDeliveryRepository"
);

describe(
  "Fila persistente de conversões de marketing",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClient.query.mockReset();
    });

    test(
      "não cria nova entrega quando a assinatura já foi enviada",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 7,
                provedor: "google",
                tipo_evento:
                  "SUBSCRIPTION_ACTIVATED",
                chave_evento:
                  "assinatura:11",
                status: "SENT",
                payload: {
                  assinaturaId: 11,
                  pagamentoId:
                    "pay_antigo"
                }
              },
              {
                id: 8,
                provedor: "google",
                tipo_evento:
                  "SUBSCRIPTION_ACTIVATED",
                chave_evento:
                  "assinatura:11;pagamento:pay_novo",
                status: "PENDING",
                payload: {
                  assinaturaId: 11,
                  pagamentoId:
                    "pay_novo"
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        const resultado =
          await repository.enfileirar({
            provedor: "google",
            tipoEvento:
              "SUBSCRIPTION_ACTIVATED",
            chaveEvento:
              "assinatura:11",
            payload: {
              negocioId: 7,
              assinaturaId: 11,
              pagamentoId:
                "pay_novo",
              valor: 59.9
            }
          });

        expect(resultado.novo)
          .toBe(false);
        expect(resultado.rearmado)
          .toBe(false);
        expect(resultado.entrega.id)
          .toBe(7);
        expect(
          mockClient.query.mock.calls[2][0]
        ).toContain(
          "status = 'IGNORED'"
        );
      }
    );

    test(
      "rearma a mesma entrega com pagamento válido mais recente",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 9,
                chave_evento:
                  "assinatura:11;pagamento:pay_antigo",
                status: "FAILED",
                payload: {
                  assinaturaId: 11,
                  pagamentoId:
                    "pay_antigo"
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 9,
                chave_evento:
                  "assinatura:11",
                status: "PENDING",
                tentativas: 0,
                payload: {
                  assinaturaId: 11,
                  pagamentoId:
                    "pay_novo"
                }
              }
            ]
          });

        const resultado =
          await repository.enfileirar({
            provedor: "meta",
            tipoEvento:
              "SUBSCRIPTION_ACTIVATED",
            chaveEvento:
              "assinatura:11",
            payload: {
              negocioId: 7,
              assinaturaId: 11,
              pagamentoId:
                "pay_novo",
              valor: 59.9
            }
          });

        expect(resultado.novo)
          .toBe(false);
        expect(resultado.rearmado)
          .toBe(true);
        expect(resultado.entrega)
          .toMatchObject({
            id: 9,
            chave_evento:
              "assinatura:11",
            status: "PENDING",
            tentativas: 0
          });
        expect(
          mockClient.query.mock.calls[2][0]
        ).toContain(
          "tentativas = 0"
        );
      }
    );

    test(
      "reserva com SKIP LOCKED, limita a cinco tentativas e só repete FAILED agendado",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .reservarProximo();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "FOR UPDATE SKIP LOCKED"
        );
        expect(
          sql.match(/tentativas < 5/g)
        ).toHaveLength(3);
        expect(sql).toContain(
          "proxima_tentativa_em IS NOT NULL"
        );
        expect(sql).toContain(
          "proxima_tentativa_em <= NOW()"
        );
      }
    );

    test(
      "finalização usa lease e reconcilia tentativa terminal antiga",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarEnviado(9, 5);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5
        ]);
      }
    );

    test(
      "resultado ignorado também reconcilia a mesma tentativa terminal",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarIgnorado(
            9,
            5,
            "sem_consentimento"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5,
          "sem_consentimento"
        ]);
      }
    );

    test(
      "quinta falha não agenda uma sexta tentativa",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalha(
            9,
            5,
            "falha externa"
          );

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "WHEN tentativas < 5"
        );
        expect(sql).toContain(
          "ELSE NULL"
        );
      }
    );

    test(
      "falha técnica terminal não fica elegível a retry",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalhaTerminal(
            9,
            2,
            "event_id_invalido"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "proxima_tentativa_em = NULL"
        );
        expect(sql).toContain(
          "status = 'PROCESSING'"
        );
        expect(sql).not.toContain(
          "WHEN tentativas < 5"
        );
        expect(parametros).toEqual([
          9,
          2,
          "event_id_invalido"
        ]);
      }
    );
  }
);
