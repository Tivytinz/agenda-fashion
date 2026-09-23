const mockClient = {
  query: jest.fn(),
};

const mockRepository = {
  listarIntegracoes:
    jest.fn(),
  listarExecucoesRecentes:
    jest.fn(),
  buscarFonteAtivaPorId:
    jest.fn(),
  criarIntegracao:
    jest.fn(),
  atualizarIntegracao:
    jest.fn(),
  buscarIntegracaoPorId:
    jest.fn(),
  listarIntegracoesVencidas:
    jest.fn(),
  executarComLockIntegracao:
    jest.fn(),
  iniciarSincronizacao:
    jest.fn(),
  executarTransacao:
    jest.fn(),
  finalizarSincronizacaoSucesso:
    jest.fn(),
  finalizarSincronizacaoErro:
    jest.fn(),
  buscarCustoPorChave:
    jest.fn(),
  buscarSaldoDebito:
    jest.fn(),
};

const mockAdaptador = {
  nome: "Adaptador teste",
  coletar: jest.fn(),
};

const mockProviders = {
  listarAdaptadores:
    jest.fn(),
  obterAdaptador:
    jest.fn(),
  codigoAdaptador:
    jest.fn(
      (valor) =>
        String(valor || "")
          .trim()
          .toLowerCase()
    ),
};

const mockContributionService = {
  registrarCustoObservado:
    jest.fn(),
  registrarCoberturaFonte:
    jest.fn(),
};

jest.mock(
  "../src/repositories/contributionCostSyncRepository",
  () => mockRepository
);

jest.mock(
  "../src/services/contributionCostProviderRegistry",
  () => mockProviders
);

jest.mock(
  "../src/services/contributionEconomicsService",
  () => mockContributionService
);

const service = require(
  "../src/services/contributionCostSyncService"
);

describe(
  "Wave 32 - contributionCostSyncService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      mockProviders
        .listarAdaptadores
        .mockReturnValue([
          {
            codigo:
              "provider_test",
            nome:
              "Adaptador teste",
            disponivel: true,
          },
        ]);
      mockProviders
        .obterAdaptador
        .mockReturnValue(
          mockAdaptador
        );

      mockRepository
        .listarIntegracoes
        .mockResolvedValue([]);
      mockRepository
        .listarExecucoesRecentes
        .mockResolvedValue([]);
      mockRepository
        .buscarFonteAtivaPorId
        .mockResolvedValue({
          id: 9,
          codigo:
            "mensageria_variavel",
          ativa: true,
        });
      mockRepository
        .criarIntegracao
        .mockResolvedValue({
          id: 3,
          fonte_id: 9,
          adaptador:
            "provider_test",
          ativa: true,
          intervalo_minutos: 60,
        });
      mockRepository
        .atualizarIntegracao
        .mockResolvedValue({
          id: 3,
          fonte_id: 9,
          adaptador:
            "provider_test",
          ativa: false,
          intervalo_minutos: 60,
        });
      mockRepository
        .buscarIntegracaoPorId
        .mockResolvedValue({
          id: 3,
          fonte_id: 9,
          fonte_codigo:
            "mensageria_variavel",
          fonte_nome:
            "Mensageria",
          fonte_ativa: true,
          adaptador:
            "provider_test",
          ativa: true,
          cursor: {},
        });
      mockRepository
        .executarComLockIntegracao
        .mockImplementation(
          async (
            _id,
            callback
          ) => ({
            executado: true,
            resultado:
              await callback(),
          })
        );
      mockRepository
        .iniciarSincronizacao
        .mockResolvedValue({
          id: 44,
        });
      mockRepository
        .executarTransacao
        .mockImplementation(
          async (
            callback
          ) =>
            callback(
              mockClient
            )
        );
      mockRepository
        .buscarCustoPorChave
        .mockResolvedValue(null);
      mockRepository
        .buscarSaldoDebito
        .mockResolvedValue(10);
      mockRepository
        .finalizarSincronizacaoSucesso
        .mockResolvedValue();
      mockRepository
        .finalizarSincronizacaoErro
        .mockResolvedValue();

      mockContributionService
        .registrarCustoObservado
        .mockResolvedValue({
          id: 100,
          replay: false,
        });
      mockContributionService
        .registrarCoberturaFonte
        .mockResolvedValue({
          fonte_id: 9,
        });

      mockAdaptador.coletar
        .mockResolvedValue({
          itens: [
            {
              chaveOrigem:
                "evt_1",
              negocioId: 8,
              tipo: "DEBITO",
              valor: 12.5,
              ocorridoEm:
                "2026-09-23T20:00:00Z",
            },
          ],
          cobertura: {
            inicioCobertura:
              "2026-09-01",
            cobertoAte:
              "2026-09-23",
            status:
              "COMPLETA",
          },
          proximoCursor: {
            pagina: 2,
          },
        });
    });

    test(
      "não cria integração sem adaptador real registrado",
      async () => {
        mockProviders
          .obterAdaptador
          .mockReturnValue(null);

        await expect(
          service.criarIntegracao({
            payload: {
              fonteId: 9,
              adaptador:
                "inexistente",
            },
            superadmin: true,
          })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          mockRepository
            .criarIntegracao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "restringe configuração automática ao superadmin",
      async () => {
        await expect(
          service.criarIntegracao({
            payload: {
              fonteId: 9,
              adaptador:
                "provider_test",
            },
            superadmin: false,
          })
        ).rejects.toMatchObject({
          statusCode: 403,
        });
      }
    );

    test(
      "cria vínculo somente com fonte ativa e adaptador conhecido",
      async () => {
        const resultado =
          await service
            .criarIntegracao({
              payload: {
                fonteId: 9,
                adaptador:
                  "provider_test",
                intervaloMinutos: 60,
                ativa: true,
              },
              superadmin: true,
            });

        expect(
          mockRepository
            .criarIntegracao
        ).toHaveBeenCalledWith({
          fonteId: 9,
          adaptador:
            "provider_test",
          intervaloMinutos: 60,
          ativa: true,
        });

        expect(resultado)
          .toMatchObject({
            integracao: {
              id: 3,
              fonteId: 9,
              adaptador:
                "provider_test",
              ativa: true,
            },
          });
      }
    );

    test(
      "permite pausar integração mesmo se o adaptador deixar de existir",
      async () => {
        mockProviders
          .obterAdaptador
          .mockReturnValue(null);

        const resultado =
          await service
            .atualizarIntegracao({
              integracaoId: 3,
              payload: {
                ativa: false,
                intervaloMinutos: 60,
              },
              superadmin: true,
            });

        expect(
          mockRepository
            .atualizarIntegracao
        ).toHaveBeenCalledWith({
          integracaoId: 3,
          ativa: false,
          intervaloMinutos: 60,
        });

        expect(resultado)
          .toMatchObject({
            integracao: {
              id: 3,
              ativa: false,
            },
          });
      }
    );

    test(
      "não reativa integração sem adaptador disponível",
      async () => {
        mockProviders
          .obterAdaptador
          .mockReturnValue(null);

        await expect(
          service
            .atualizarIntegracao({
              integracaoId: 3,
              payload: {
                ativa: true,
              },
              superadmin: true,
            })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          mockRepository
            .atualizarIntegracao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "persiste fatos, cobertura e cursor na mesma transação",
      async () => {
        const resultado =
          await service
            .sincronizarIntegracao({
              integracaoId: 3,
            });

        expect(
          mockAdaptador.coletar
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            integracaoId: 3,
            fonte:
              expect.objectContaining({
                id: 9,
                codigo:
                  "mensageria_variavel",
              }),
            cursor: {},
          })
        );

        expect(
          mockContributionService
            .registrarCustoObservado
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            fonteCodigo:
              "mensageria_variavel",
            negocioId: 8,
            chaveOrigem:
              "evt_1",
            tipo: "DEBITO",
            valor: 12.5,
            detalhes:
              expect.objectContaining({
                origem:
                  "sync_wave32",
                adaptador:
                  "provider_test",
                integracaoId: 3,
              }),
          }),
          {
            executor:
              mockClient,
          }
        );

        expect(
          mockContributionService
            .registrarCoberturaFonte
        ).toHaveBeenCalledWith(
          {
            fonteCodigo:
              "mensageria_variavel",
            inicioCobertura:
              "2026-09-01",
            cobertoAte:
              "2026-09-23",
            status:
              "COMPLETA",
          },
          {
            executor:
              mockClient,
          }
        );

        expect(
          mockRepository
            .finalizarSincronizacaoSucesso
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            execucaoId: 44,
            integracaoId: 3,
            cursorSaida: {
              pagina: 2,
            },
            itensRecebidos: 1,
            itensImportados: 1,
            itensReplay: 0,
          }),
          mockClient
        );

        expect(resultado)
          .toMatchObject({
            status: "sucesso",
            itensRecebidos: 1,
            itensImportados: 1,
            itensReplay: 0,
          });
      }
    );

    test(
      "replay idêntico não conta como nova importação",
      async () => {
        mockContributionService
          .registrarCustoObservado
          .mockResolvedValue({
            id: 100,
            replay: true,
          });

        const resultado =
          await service
            .sincronizarIntegracao({
              integracaoId: 3,
            });

        expect(resultado)
          .toMatchObject({
            itensImportados: 0,
            itensReplay: 1,
          });
      }
    );

    test(
      "crédito automático exige débito externo da mesma fonte e respeita saldo",
      async () => {
        mockAdaptador.coletar
          .mockResolvedValue({
            itens: [
              {
                chaveOrigem:
                  "refund_1",
                negocioId: 8,
                tipo: "CREDITO",
                valor: 4,
                ocorridoEm:
                  "2026-09-23T21:00:00Z",
                referenciaChaveOrigem:
                  "charge_1",
              },
            ],
            proximoCursor: {},
          });

        mockRepository
          .buscarCustoPorChave
          .mockImplementation(
            async ({
              chaveOrigem,
            }) => {
              if (
                chaveOrigem ===
                "charge_1"
              ) {
                return {
                  id: 50,
                  fonte_id: 9,
                  negocio_id: 8,
                  chave_origem:
                    "charge_1",
                  tipo: "DEBITO",
                  valor: "10.00",
                };
              }

              return null;
            }
          );

        mockRepository
          .buscarSaldoDebito
          .mockResolvedValue(6);

        await service
          .sincronizarIntegracao({
            integracaoId: 3,
          });

        expect(
          mockRepository
            .buscarSaldoDebito
        ).toHaveBeenCalledWith(
          {
            fonteId: 9,
            negocioId: 8,
            debitoId: 50,
          },
          mockClient
        );

        expect(
          mockContributionService
            .registrarCustoObservado
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            tipo: "CREDITO",
            custoReferenciadoId: 50,
          }),
          {
            executor:
              mockClient,
          }
        );
      }
    );

    test(
      "não avança cobertura nem cursor quando o adaptador falha",
      async () => {
        mockAdaptador.coletar
          .mockRejectedValue(
            new Error(
              "provedor indisponível"
            )
          );

        await expect(
          service
            .sincronizarIntegracao({
              integracaoId: 3,
            })
        ).rejects.toThrow(
          "provedor indisponível"
        );

        expect(
          mockRepository
            .finalizarSincronizacaoSucesso
        ).not.toHaveBeenCalled();

        expect(
          mockRepository
            .finalizarSincronizacaoErro
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            execucaoId: 44,
            integracaoId: 3,
            erroDetalhe:
              "Falha interna na sincronização da fonte factual.",
          })
        );
      }
    );

    test(
      "recusa cobertura futura devolvida pelo adaptador",
      () => {
        expect(
          () =>
            service
              .normalizarCobertura({
                inicioCobertura:
                  "2099-01-01",
                cobertoAte:
                  "2099-01-02",
                status:
                  "COMPLETA",
              })
        ).toThrow(
          /cobertura futura/i
        );
      }
    );

    test(
      "recusa execução concorrente da mesma integração",
      async () => {
        mockRepository
          .executarComLockIntegracao
          .mockResolvedValue({
            executado: false,
            resultado: null,
          });

        await expect(
          service
            .sincronizarIntegracao({
              integracaoId: 3,
            })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          mockAdaptador.coletar
        ).not.toHaveBeenCalled();
      }
    );
  }
);
