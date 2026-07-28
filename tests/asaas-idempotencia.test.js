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
  criarCobrancaPix,
  criarClienteAsaas,
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
      "reutiliza cliente encontrado pela referência externa",
      async () => {
        mockGet.mockResolvedValue({
          data: {
            data: [
              {
                id:
                  "cus_existente",
                externalReference:
                  "negocio:7",
              },
            ],
          },
        });

        const resultado =
          await criarClienteAsaas({
            nome: "Studio",
            cpfCnpj:
              "12345678901",
            externalReference:
              "negocio:7",
            reutilizarPorExternalReference:
              true,
          });

        expect(mockGet)
          .toHaveBeenCalledWith(
            "/customers",
            {
              params: {
                externalReference:
                  "negocio:7",
                limit: 1,
                offset: 0,
              },
            }
          );

        expect(mockPost)
          .not.toHaveBeenCalled();

        expect(resultado.id)
          .toBe(
            "cus_existente"
          );
      }
    );

    test(
      "reutiliza cobrança PIX encontrada pela referência externa",
      async () => {
        mockGet.mockResolvedValue({
          data: {
            data: [
              {
                id:
                  "pay_existente",
                externalReference:
                  "checkout:1;assinatura:2",
              },
            ],
          },
        });

        const resultado =
          await criarCobrancaPix({
            customerId:
              "cus_1",
            valor: 99.9,
            descricao:
              "Agenda Fashion",
            externalReference:
              "checkout:1;assinatura:2",
            reutilizarPorExternalReference:
              true,
          });

        expect(mockGet)
          .toHaveBeenCalledWith(
            "/payments",
            {
              params: {
                externalReference:
                  "checkout:1;assinatura:2",
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
            "pay_existente"
          );
      }
    );

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
