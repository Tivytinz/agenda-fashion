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
      "recusa cliente novo sem CPF/CNPJ antes de iniciar a tentativa",
      async () => {
        const apiUrlAnterior =
          process.env.ASAAS_API_URL;

        process.env.ASAAS_API_URL =
          "https://api.asaas.com/v3";

        checkoutRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            nome: "Studio",
            asaas_customer_id: null
          });

        try {
          await expect(
            criarCheckout({
              usuarioId: 1,
              planoId: 3,
              formaPagamento: "pix",
              chaveIdempotencia:
                "checkout-chave-123456"
            })
          ).rejects.toMatchObject({
            message:
              "Informe um CPF/CNPJ válido para gerar a cobrança.",
            statusCode: 400
          });

          expect(
            checkoutTentativaRepository
              .iniciar
          ).not.toHaveBeenCalled();
        } finally {
          process.env.ASAAS_API_URL =
            apiUrlAnterior;
        }
      }
    );

    test(
      "mantém cartão bloqueado sem liberação explícita",
      async () => {
        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "cartao",
            cartao: {
              nome: "Cliente",
              numero: "4111111111111111",
              validade: "12/30",
              cvv: "123"
            },
            cpfCnpj: "11144477735",
            chaveIdempotencia:
              "checkout-chave-123456"
          })
        ).rejects.toMatchObject({
          message:
            "Pagamento por cartão ainda não está disponível.",
          statusCode: 400
        });
      }
    );

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
          .toHaveBeenCalledTimes(2);
        expect(registrarPagamento)
          .toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({
              asaas_payment_id:
                "pay_1",
              pix_copia_cola: null,
              pix_qrcode: null
            })
          );
        expect(registrarPagamento)
          .toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
              asaas_payment_id:
                "pay_1",
              pix_copia_cola:
                "pix-copia-cola",
              pix_qrcode:
                "imagem"
            })
          );
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
      "salva a cobrança antes de buscar o QR Code",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: true,
            tentativa: {
              id: 34,
              status: "PROCESSING",
              assinatura_id: null
            }
          });

        registrarAssinaturaPendente
          .mockResolvedValue({
            id: 45,
            negocio_id: 7
          });

        criarCobrancaPix
          .mockResolvedValue({
            id: "pay_pendente",
            value: 99.9,
            status: "PENDING"
          });

        buscarQrCodePix
          .mockRejectedValue(
            new Error(
              "QR Code ainda indisponível"
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
          "QR Code ainda indisponível"
        );

        expect(registrarPagamento)
          .toHaveBeenCalledTimes(1);
        expect(registrarPagamento)
          .toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              assinatura_id: 45,
              asaas_payment_id:
                "pay_pendente",
              status: "PENDING",
              pix_copia_cola: null,
              pix_qrcode: null
            })
          );
        expect(
          checkoutTentativaRepository
            .marcarFalha
        ).toHaveBeenCalledWith(
          34,
          "QR Code ainda indisponível"
        );
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
