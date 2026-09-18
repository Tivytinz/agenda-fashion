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
    buscarQrCodePix: jest.fn()
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
  criarCheckout,
  consultarStatusCheckout
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
      checkoutTentativaRepository
        .concluir
        .mockResolvedValue({
          id: 1,
          status: "COMPLETED"
        });
      checkoutTentativaRepository
        .vincularAssinatura
        .mockResolvedValue({
          id: 1,
          status: "PROCESSING"
        });

      checkoutRepository
        .bloquearCheckoutDoNegocio
        .mockResolvedValue();

      checkoutRepository
        .buscarAssinaturaPendenteDoNegocio
        .mockResolvedValue(null);
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
      "recusa qualquer forma de pagamento diferente de PIX",
      async () => {
        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "cartao",
            cpfCnpj: "11144477735",
            chaveIdempotencia:
              "checkout-chave-123456"
          })
        ).rejects.toMatchObject({
          message:
            "Aceitamos pagamento somente por PIX.",
          statusCode: 400
        });
      }
    );

    test(
      "impede pagar novamente o plano atual",
      async () => {
        checkoutRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            nome: "Studio",
            plano_id: 3,
            asaas_customer_id: "cus_1"
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
          message:
            "Este já é o plano atual do seu negócio.",
          statusCode: 409
        });

        expect(
          checkoutTentativaRepository
            .iniciar
        ).not.toHaveBeenCalled();
        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "impede outro PIX pendente no mesmo negócio mesmo para outro plano",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: true,
            tentativa: {
              id: 35,
              status: "PROCESSING",
              lease_tentativa: 1,
              assinatura_id: null
            }
          });

        checkoutRepository
          .buscarAssinaturaPendenteDoNegocio
          .mockResolvedValue({
            id: 44,
            negocio_id: 7,
            plano_id: 4,
            plano_nome: "Salão",
            status: "PENDING"
          });

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "outra-chave-checkout-123"
          })
        ).rejects.toMatchObject({
          statusCode: 409,
          message:
            "Já existe uma cobrança ou ativação pendente para o plano Salão. Conclua esse processo antes de gerar outra cobrança."
        });

        expect(
          checkoutRepository
            .bloquearCheckoutDoNegocio
        ).toHaveBeenCalledWith(
          mockClient,
          7
        );
        expect(
          registrarAssinaturaPendente
        ).not.toHaveBeenCalled();
        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "retomada antiga também respeita outra pendência do negócio",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: false,
            tentativa: {
              id: 36,
              status: "PROCESSING",
              lease_tentativa: 2,
              assinatura_id: 44
            }
          });

        assinaturaRepository
          .buscarPorId
          .mockResolvedValue({
            id: 44,
            negocio_id: 7,
            plano_id: 3,
            valor: "99.90",
            status: "PENDING",
            ativo: false
          });

        checkoutRepository
          .buscarAssinaturaPendenteDoNegocio
          .mockResolvedValue({
            id: 55,
            negocio_id: 7,
            plano_id: 4,
            plano_nome: "Salão",
            status: "PENDING"
          });

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-retomada-antiga-123"
          })
        ).rejects.toMatchObject({
          statusCode: 409,
          message:
            "Já existe uma cobrança ou ativação pendente para o plano Salão. Conclua esse processo antes de gerar outra cobrança."
        });

        expect(
          checkoutRepository
            .buscarAssinaturaPendenteDoNegocio
        ).toHaveBeenCalledWith(
          mockClient,
          7,
          44
        );
        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "retomada antiga é rejeitada quando o preço do plano mudou",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: false,
            tentativa: {
              id: 37,
              status: "PROCESSING",
              lease_tentativa: 2,
              assinatura_id: 44
            }
          });

        assinaturaRepository
          .buscarPorId
          .mockResolvedValue({
            id: 44,
            negocio_id: 7,
            plano_id: 3,
            valor: "89.90",
            status: "PENDING",
            ativo: false
          });

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-preco-antigo-1234"
          })
        ).rejects.toMatchObject({
          statusCode: 409,
          message:
            "Este checkout antigo não pode mais ser retomado com segurança. Inicie uma nova tentativa com os dados atuais do plano."
        });

        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "retomada válida renova a janela da própria assinatura sob lock",
      async () => {
        checkoutTentativaRepository
          .iniciar
          .mockResolvedValue({
            executar: true,
            nova: false,
            tentativa: {
              id: 38,
              status: "PROCESSING",
              lease_tentativa: 2,
              assinatura_id: 44
            }
          });

        const assinatura = {
          id: 44,
          negocio_id: 7,
          plano_id: 3,
          valor: "99.90",
          status: "PENDING",
          ativo: false
        };

        assinaturaRepository
          .buscarPorId
          .mockResolvedValue(assinatura);
        assinaturaRepository
          .tocarAssinaturaPendenteCheckout
          .mockResolvedValue(assinatura);
        criarCobrancaPix
          .mockResolvedValue({
            id: "pay_retomado",
            value: 99.9,
            status: "PENDING"
          });
        buscarQrCodePix
          .mockResolvedValue({
            payload: "pix-retomado",
            encodedImage: "imagem"
          });

        await criarCheckout({
          usuarioId: 1,
          planoId: 3,
          formaPagamento: "pix",
          chaveIdempotencia:
            "checkout-retomada-valida-123"
        });

        expect(
          assinaturaRepository
            .tocarAssinaturaPendenteCheckout
        ).toHaveBeenCalledWith(
          44,
          mockClient
        );
        expect(criarCobrancaPix)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              externalReference:
                "checkout:38;assinatura:44",
              valor: "99.90"
            })
          );
      }
    );

    test(
      "consulta o status somente no banco local",
      async () => {
        checkoutRepository
          .buscarPagamentoCheckout
          .mockResolvedValue({
            id: 10,
            asaas_payment_id:
              "pay_1",
            status: "PENDING",
            ativo: false
          });

        const resultado =
          await consultarStatusCheckout({
            usuarioId: 1,
            pagamentoId: "pay_1"
          });

        expect(
          checkoutRepository
            .buscarPagamentoCheckout
        ).toHaveBeenCalledWith(
          "pay_1",
          1
        );
        expect(resultado.status)
          .toBe("PENDING");
      }
    );

    test(
      "expõe quando pagamento confirmado exige atenção operacional",
      async () => {
        checkoutRepository
          .buscarPagamentoCheckout
          .mockResolvedValue({
            id: 10,
            asaas_payment_id: "pay_1",
            status: "CONFIRMED",
            ativo: false,
            status_assinatura: "PENDING"
          });
        checkoutRepository
          .buscarEstadoAtivacaoPagamento
          .mockResolvedValue({
            status: "FAILED",
            tentativas: 10,
            proxima_tentativa_em: null,
            falha_terminal: true
          });

        const resultado =
          await consultarStatusCheckout({
            usuarioId: 1,
            pagamentoId: "pay_1"
          });

        expect(resultado.estado_ativacao)
          .toBe("ATIVACAO_REQUER_ATENCAO");
      }
    );

    test(
      "não consulta fila quando assinatura já está ativa",
      async () => {
        checkoutRepository
          .buscarPagamentoCheckout
          .mockResolvedValue({
            id: 10,
            asaas_payment_id: "pay_1",
            status: "RECEIVED",
            ativo: true,
            status_assinatura: "ACTIVE"
          });

        const resultado =
          await consultarStatusCheckout({
            usuarioId: 1,
            pagamentoId: "pay_1"
          });

        expect(resultado.estado_ativacao)
          .toBe("ATIVO");
        expect(
          checkoutRepository
            .buscarEstadoAtivacaoPagamento
        ).not.toHaveBeenCalled();
      }
    );

    test.each([
      {
        titulo: "usuário ausente",
        parametros: {
          usuarioId: null,
          pagamentoId: "pay_1"
        },
        statusCode: 401
      },
      {
        titulo: "pagamento ausente",
        parametros: {
          usuarioId: 1,
          pagamentoId: null
        },
        statusCode: 400
      }
    ])(
      "retorna status operacional para $titulo",
      async ({ parametros, statusCode }) => {
        await expect(
          consultarStatusCheckout(parametros)
        ).rejects.toMatchObject({
          statusCode
        });
      }
    );

    test(
      "retorna 404 quando o pagamento não existe",
      async () => {
        checkoutRepository
          .buscarPagamentoCheckout
          .mockResolvedValue(null);

        await expect(
          consultarStatusCheckout({
            usuarioId: 1,
            pagamentoId: "pay_inexistente"
          })
        ).rejects.toMatchObject({
          statusCode: 404,
          message: "Pagamento não encontrado."
        });
      }
    );

    test.each([
      {
        titulo: "negócio",
        preparar: () =>
          checkoutRepository
            .buscarNegocioDono
            .mockResolvedValue(null),
        statusCode: 404
      },
      {
        titulo: "plano",
        preparar: () =>
          checkoutRepository
            .buscarPlano
            .mockResolvedValue(null),
        statusCode: 404
      }
    ])(
      "retorna 404 quando $titulo não existe",
      async ({ preparar, statusCode }) => {
        preparar();

        await expect(
          criarCheckout({
            usuarioId: 1,
            planoId: 3,
            formaPagamento: "pix",
            chaveIdempotencia:
              "checkout-chave-123456"
          })
        ).rejects.toMatchObject({
          statusCode
        });

        expect(
          checkoutTentativaRepository.iniciar
        ).not.toHaveBeenCalled();
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
              lease_tentativa: 1,
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
        expect(
          checkoutTentativaRepository
            .vincularAssinatura
        ).toHaveBeenCalledWith(
          31,
          44,
          1,
          mockClient
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
          }),
          1
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
              lease_tentativa: 1,
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
          "QR Code ainda indisponível",
          1
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
              status: "PROCESSING",
              lease_tentativa: 1
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
          "falha temporária",
          1
        );
      }
    );
  }
);
