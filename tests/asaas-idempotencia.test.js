const mockGet =
  jest.fn();

const mockPost =
  jest.fn();

jest.mock(
  "axios",
  () => ({
    create: jest.fn(
      () => ({
        get: mockGet,
        post: mockPost,
        put: jest.fn(),
        delete: jest.fn(),
      })
    ),
  })
);

process.env.ASAAS_API_URL =
  "https://sandbox.asaas.test/v3";

process.env.ASAAS_API_KEY =
  "chave-de-teste";

const {
  criarAssinaturaAsaas,
} = require(
  "../src/services/asaasService"
);

describe(
  "Idempotência da assinatura no Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "reutiliza assinatura encontrada pela referência externa",
      async () => {
        mockGet.mockResolvedValue({
          data: {
            data: [
              {
                id:
                  "sub_existente",
                externalReference:
                  "assinatura:10",
              },
            ],
          },
        });

        const resultado =
          await criarAssinaturaAsaas({
            customerId:
              "cus_1",
            valor: 39.9,
            descricao:
              "Agenda Fashion",
            formaPagamento:
              "pix",
            externalReference:
              "assinatura:10",
            proximaCobranca:
              "2026-08-28",
            reutilizarPorExternalReference:
              true,
          });

        expect(mockGet)
          .toHaveBeenCalledWith(
            "/subscriptions",
            {
              params: {
                externalReference:
                  "assinatura:10",
                limit: 1,
                offset: 0,
                customer:
                  "cus_1",
              },
            }
          );

        expect(mockPost)
          .not.toHaveBeenCalled();

        expect(resultado.id)
          .toBe(
            "sub_existente"
          );
      }
    );

    test(
      "cria assinatura quando a referência ainda não existe",
      async () => {
        mockGet.mockResolvedValue({
          data: {
            data: [],
          },
        });

        mockPost.mockResolvedValue({
          data: {
            id: "sub_nova",
          },
        });

        const resultado =
          await criarAssinaturaAsaas({
            customerId:
              "cus_1",
            valor: 39.9,
            descricao:
              "Agenda Fashion",
            formaPagamento:
              "pix",
            externalReference:
              "assinatura:11",
            proximaCobranca:
              "2026-08-28",
            reutilizarPorExternalReference:
              true,
          });

        expect(mockPost)
          .toHaveBeenCalledTimes(1);

        expect(resultado.id)
          .toBe("sub_nova");
      }
    );
  }
);
