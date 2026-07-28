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
      }
    );
  }
);
