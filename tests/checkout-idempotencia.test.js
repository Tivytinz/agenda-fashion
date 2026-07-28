jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

jest.mock(
  "../src/repositories/checkoutRepository"
);

jest.mock(
  "../src/repositories/checkoutTentativaRepository"
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    criarClienteAsaas: jest.fn(),
    criarAssinaturaAsaas: jest.fn(),
    criarCobrancaPix: jest.fn(),
    buscarQrCodePix: jest.fn(),
    buscarPagamentoAsaas: jest.fn()
  })
);

jest.mock(
  "../src/services/assinaturaService",
  () => ({
    registrarAssinaturaPendente:
      jest.fn(),
    registrarPagamento:
      jest.fn(),
    ativarAssinaturaPorPagamento:
      jest.fn()
  })
);

const checkoutRepository = require(
  "../src/repositories/checkoutRepository"
);
const checkoutTentativaRepository = require(
  "../src/repositories/checkoutTentativaRepository"
);
const {
  criarCobrancaPix,
  buscarQrCodePix
} = require(
  "../src/services/asaasService"
);
const {
  registrarAssinaturaPendente,
  registrarPagamento
} = require(
  "../src/services/assinaturaService"
);
const {
  criarCheckout
} = require(
  "../src/services/checkoutService"
);

describe(
  "Idempotência do checkout",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      checkoutRepository
        .buscarNegocioDono
        .mockResolvedValue({
          id: 7,
          nome: "Studio",
          asaas_customer_id:
            "cus_1"
        });

      checkoutRepository
        .buscarPlano
        .mockResolvedValue({
          id: 3,
          nome: "Studio",
          slug: "studio",
          valor: "99.90"
        });

      checkoutTentativaRepository
        .marcarFalha
        .mockResolvedValue({});
    });

    test(
      "devolve a resposta salva sem criar nova cobrança",
      async () => {
        const respostaSalva = {
          mensagem:
            "PIX gerado com sucesso.",
          forma_pagamento: "pix",
          pagamento: {
            id: "pay_existente"
          }
        };

        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: false,
            nova: false,
            tentativa: {
              id: 30,
              status: "COMPLETED",
              resposta:
                respostaSalva
            }
          });

        const resultado =
          await criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-chave-123456"
          });

        expect(resultado)
          .toEqual(respostaSalva);
        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "cria só uma cobrança reconciliável pela referência externa",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: true,
            tentativa: {
              id: 31,
              status: "PROCESSING",
              assinatura_id: null
            }
          });

        registrarAssinaturaPendente
          .mockResolvedValue({
            id: 44,
            negocio_id: 7
          });

        criarCobrancaPix
          .mockResolvedValue({
            id: "pay_1",
            value: 99.9,
            status: "PENDING"
          });

        buscarQrCodePix
          .mockResolvedValue({
            payload: "pix-copia-cola",
            encodedImage: "imagem"
          });

        const resultado =
          await criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-chave-123456"
          });

        expect(criarCobrancaPix)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              externalReference:
                "checkout:31;assinatura:44",
              reutilizarPorExternalReference:
                true
            })
          );
        expect(registrarPagamento)
          .toHaveBeenCalledTimes(1);
        expect(
          checkoutTentativaRepository
            .concluir
        ).toHaveBeenCalledWith(
          31,
          expect.objectContaining({
            forma_pagamento: "pix"
          })
        );
        expect(
          resultado.pagamento.id
        ).toBe("pay_1");
      }
    );

    test(
      "retorna conflito enquanto a mesma tentativa está em andamento",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: false,
            nova: false,
            tentativa: {
              id: 32,
              status: "PROCESSING"
            }
          });

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-chave-123456"
          })
        ).rejects.toMatchObject({
          statusCode: 409
        });
      }
    );

    test(
      "marca a tentativa como falha para permitir recuperação",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: true,
            tentativa: {
              id: 33,
              status: "PROCESSING"
            }
          });

        registrarAssinaturaPendente
          .mockRejectedValue(
            new Error(
              "falha temporária"
            )
          );

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-chave-123456"
          })
        ).rejects.toThrow(
          "falha temporária"
        );

        expect(
          checkoutTentativaRepository
            .marcarFalha
        ).toHaveBeenCalledWith(
          33,
          "falha temporária"
        );
      }
    );
  }
);
