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
              status: "PROCESSING",
              lease_tentativa: 1
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
                status: "PROCESSING",
                lease_tentativa: 2
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
        expect(resultado.tentativa.lease_tentativa)
          .toBe(2);
        expect(db.query.mock.calls[2][0])
          .toContain("lease_tentativa = lease_tentativa + 1");
      }
    );

    test(
      "vínculo da assinatura exige o lease corrente",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        const resultado =
          await repository.vincularAssinatura(
            1,
            44,
            3
          );

        expect(resultado).toBeNull();
        expect(db.query.mock.calls[0][0])
          .toContain("lease_tentativa = $3");
        expect(db.query.mock.calls[0][1])
          .toEqual([1, 44, 3]);
      }
    );

    test(
      "valida o lease antes de efeitos externos",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1 }]
        });

        await expect(
          repository.validarLease(
            1,
            4
          )
        ).resolves.toBe(true);

        expect(db.query.mock.calls[0][0])
          .toContain("status = 'PROCESSING'");
        expect(db.query.mock.calls[0][0])
          .toContain("lease_tentativa = $2");
      }
    );

    test(
      "finalização exige o lease corrente",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        const resultado = await repository.concluir(
          1,
          { pagamento: { id: "pay_1" } },
          2
        );

        expect(resultado).toBeNull();
        expect(db.query.mock.calls[0][0])
          .toContain("lease_tentativa = $3");
        expect(db.query.mock.calls[0][1][2]).toBe(2);
      }
    );
  }
);
