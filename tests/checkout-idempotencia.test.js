jest.mock("../src/repositories/assinaturaRenovacaoRepository");
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
const assinaturaRepository = require("../src/repositories/assinaturaRepository");
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
      require("../src/repositories/assinaturaRenovacaoRepository").possuiPendente.mockResolvedValue(false);
      require("../src/repositories/assinaturaRenovacaoRepository").buscarPendente.mockResolvedValue(null);

      checkoutRepository
        .buscarNegocioDono
        .mockResolvedValue({
          id: 7,
          nome: "Studio",
          publicado: true,
          asaas_customer_id:
            "cus_1"
        });

      checkoutRepository
        .buscarPlano
        .mockResolvedValue({
          id: 3,
          nome: "Studio",
          slug: "studio",
          valor: "20.00"
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
      checkoutRepository.bloquearContaDonoCheckout.mockResolvedValue(true);
      checkoutRepository.buscarElegibilidadeCheckout.mockResolvedValue({
        id: 7, plano_id: 1, publicado: true
      });

      checkoutRepository
        .buscarAssinaturaPendenteDoNegocio
        .mockResolvedValue(null);
    });

    test(
      "recusa checkout pago quando o negócio ainda não está publicado",
      async () => {
        checkoutRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            nome: "Studio",
            plano_id: 1,
            publicado: false,
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
            "Publique seu negócio antes de iniciar um checkout pago.",
          statusCode: 409
        });

        expect(
          checkoutRepository
            .buscarPlano
        ).not.toHaveBeenCalled();
        expect(
          checkoutTentativaRepository
            .iniciar
        ).not.toHaveBeenCalled();
        expect(criarCobrancaPix)
          .not.toHaveBeenCalled();
      }
    );

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
            publicado: true,
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
            publicado: true,
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
            "Já existe um PIX pendente para o plano Salão. Conclua ou aguarde o vencimento antes de gerar outra cobrança."
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
      "CA-NFR-02: retry da mesma chave devolve resposta salva sem criar nova cobrança",
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
            value: 20,
            status: "PENDING",
            invoiceUrl:
              "https://www.asaas.com/i/checkout-wave20"
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
              invoice_url:
                "https://www.asaas.com/i/checkout-wave20",
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
              invoice_url:
                "https://www.asaas.com/i/checkout-wave20",
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
      "impede PIX de dona desativada após a leitura inicial",
      async () => {
        checkoutTentativaRepository.iniciar.mockResolvedValue({
          executar: true,
          tentativa: { id: 51, status: "PROCESSING", lease_tentativa: 1 }
        });
        checkoutRepository.bloquearContaDonoCheckout.mockResolvedValue(false);

        await expect(criarCheckout({
          usuarioId: 1, planoId: 3, formaPagamento: "pix",
          chaveIdempotencia: "checkout-dona-desativada-12345"
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(registrarAssinaturaPendente).not.toHaveBeenCalled();
        expect(criarCobrancaPix).not.toHaveBeenCalled();
      }
    );

    test(
      "revalida a publicação e o vínculo antes de persistir a assinatura",
      async () => {
        checkoutTentativaRepository.iniciar.mockResolvedValue({
          executar: true,
          tentativa: { id: 52, status: "PROCESSING", lease_tentativa: 1 }
        });
        checkoutRepository.buscarElegibilidadeCheckout.mockResolvedValue(null);

        await expect(criarCheckout({
          usuarioId: 1, planoId: 3, formaPagamento: "pix",
          chaveIdempotencia: "checkout-vinculo-revogado-123"
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(registrarAssinaturaPendente).not.toHaveBeenCalled();
        expect(criarCobrancaPix).not.toHaveBeenCalled();
      }
    );

    test(
      "bloqueia valor divergente retornado pelo Asaas sem registrar cobrança",
      async () => {
        checkoutTentativaRepository.iniciar.mockResolvedValue({
          executar: true,
          tentativa: { id: 53, status: "PROCESSING", lease_tentativa: 1 }
        });
        registrarAssinaturaPendente.mockResolvedValue({
          id: 71, negocio_id: 7, plano_id: 3, valor: "20.00"
        });
        criarCobrancaPix.mockResolvedValue({
          id: "pay_valor_incorreto", value: 10, status: "PENDING"
        });

        await expect(criarCheckout({
          usuarioId: 1, planoId: 3, formaPagamento: "pix",
          chaveIdempotencia: "checkout-valor-divergente-123"
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(registrarPagamento).not.toHaveBeenCalled();
        expect(buscarQrCodePix).not.toHaveBeenCalled();
      }
    );

    test(
      "recusa mudança de preço no catálogo antes de abrir a cobrança",
      async () => {
        checkoutTentativaRepository.iniciar.mockResolvedValue({
          executar: true,
          tentativa: { id: 54, status: "PROCESSING", lease_tentativa: 1 }
        });
        checkoutRepository.buscarPlano
          .mockResolvedValueOnce({ id: 3, slug: "studio", valor: "20.00" })
          .mockResolvedValueOnce({ id: 3, slug: "studio", valor: "25.00" });

        await expect(criarCheckout({
          usuarioId: 1, planoId: 3, formaPagamento: "pix",
          chaveIdempotencia: "checkout-preco-mudou-12345"
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(criarCobrancaPix).not.toHaveBeenCalled();
      }
    );

    test(
      "retoma o valor original quando a tentativa já tem assinatura",
      async () => {
        checkoutTentativaRepository.iniciar.mockResolvedValue({
          executar: true,
          tentativa: {
            id: 55, status: "PROCESSING", lease_tentativa: 3, assinatura_id: 88
          }
        });
        checkoutRepository.buscarPlano
          .mockResolvedValueOnce({ id: 3, slug: "studio", valor: "25.00" })
          .mockResolvedValueOnce({ id: 3, slug: "studio", valor: "25.00" });
        assinaturaRepository.buscarPorId.mockResolvedValue({
          id: 88, negocio_id: 7, plano_id: 3, valor: "20.00"
        });
        criarCobrancaPix.mockResolvedValue({
          id: "pay_contrato_antigo", value: 20,
          status: "PENDING"
        });
        buscarQrCodePix.mockResolvedValue({ payload: "pix-congelado" });

        await criarCheckout({
          usuarioId: 1, planoId: 3, formaPagamento: "pix",
          chaveIdempotencia: "checkout-snapshot-antigo-123"
        });

        expect(criarCobrancaPix).toHaveBeenCalledWith(expect.objectContaining({
          valor: "20.00"
        }));
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
            value: 20,
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
