jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/checkoutTentativaRepository"
);

describe(
  "Repository de tentativas do checkout",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "assume uma chave nova",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PROCESSING"
            }
          ]
        });

        const resultado =
          await repository.iniciar({
            negocioId: 7,
            chaveIdempotencia:
              "checkout-chave-123456",
            requestHash: "hash"
          });

        expect(resultado.executar)
          .toBe(true);
        expect(resultado.nova)
          .toBe(true);
      }
    );

    test(
      "reutiliza a resposta de uma tentativa concluída",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                request_hash: "hash",
                status: "COMPLETED",
                resposta: {
                  pagamento: {
                    id: "pay_1"
                  }
                }
              }
            ]
          });

        const resultado =
          await repository.iniciar({
            negocioId: 7,
            chaveIdempotencia:
              "checkout-chave-123456",
            requestHash: "hash"
          });

        expect(resultado.executar)
          .toBe(false);
        expect(
          resultado.tentativa
            .resposta.pagamento.id
        ).toBe("pay_1");
      }
    );

    test(
      "rejeita a reutilização da chave em outro pedido",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                request_hash:
                  "outro-hash",
                status: "COMPLETED"
              }
            ]
          });

        await expect(
          repository.iniciar({
            negocioId: 7,
            chaveIdempotencia:
              "checkout-chave-123456",
            requestHash: "hash"
          })
        ).rejects.toMatchObject({
          code:
            "IDEMPOTENCY_KEY_REUSED"
        });
      }
    );

    test(
      "retoma tentativa que falhou",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                request_hash: "hash",
                status: "FAILED"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                request_hash: "hash",
                status: "PROCESSING"
              }
            ]
          });

        const resultado =
          await repository.iniciar({
            negocioId: 7,
            chaveIdempotencia:
              "checkout-chave-123456",
            requestHash: "hash"
          });

        expect(resultado.executar)
          .toBe(true);
        expect(resultado.nova)
          .toBe(false);

        const sqlRetomada =
          db.query.mock.calls[2][0];
        expect(sqlRetomada).toContain(
          "execucao_versao = execucao_versao + 1"
        );
      }
    );

    test(
      "finaliza somente a versão de execução que ainda possui o lease",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        const resultado =
          await repository.concluir(
            9,
            { pagamento: { id: "pay_9" } },
            3
          );

        expect(resultado).toBeNull();

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "AND status = 'PROCESSING'"
        );
        expect(sql).toContain(
          "AND execucao_versao = $3"
        );
        expect(parametros[2]).toBe(3);
      }
    );
  }
);
