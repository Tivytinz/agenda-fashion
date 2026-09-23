const mockClient = {
  query: jest.fn(),
};

const mockExecutarTransacao =
  jest.fn(
    async (
      callback
    ) => callback(
      mockClient
    )
  );

jest.mock(
  "../src/repositories/adminContributionOperationsRepository",
  () => ({
    executarTransacao:
      mockExecutarTransacao,
    listarPainel:
      jest.fn(),
    buscarNegocioPorId:
      jest.fn(),
    buscarCustoPorFonteChave:
      jest.fn(),
    validarCreditoDisponivel:
      jest.fn(),
    criarFonte:
      jest.fn(),
    registrarOperacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/contributionEconomicsService",
  () => ({
    registrarCustoObservado:
      jest.fn(),
    registrarCoberturaFonte:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminContributionOperationsRepository"
);
const contributionEconomicsService =
  require(
    "../src/services/contributionEconomicsService"
  );
const service = require(
  "../src/services/adminContributionOperationsService"
);

describe(
  "Wave 31 - operacoes administrativas de contribuicao",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      repository
        .listarPainel
        .mockResolvedValue({
          inicio_cobertura:
            "2026-09-23T22:00:00.000Z",
          fontes: [],
          custos: [],
          operacoes: [],
        });

      repository
        .buscarNegocioPorId
        .mockResolvedValue({
          id: 8,
          nome: "Studio Teste",
        });

      repository
        .buscarCustoPorFonteChave
        .mockResolvedValue(null);

      repository
        .registrarOperacao
        .mockResolvedValue({
          id: 1,
        });
    });

    test(
      "permite leitura para admin comum mas bloqueia qualquer escrita financeira",
      async () => {
        await expect(
          service.buscarPainel({
            superadmin: false,
          })
        ).resolves.toMatchObject({
          podeEditar: false,
          fontes: [],
        });

        await expect(
          service.criarFonte({
            payload: {
              codigo:
                "mensageria_variavel",
              nome:
                "Mensageria variável",
              categoria:
                "comunicacao",
              motivo:
                "Fonte factual",
            },
            usuarioId: 7,
            superadmin: false,
          })
        ).rejects.toMatchObject({
          statusCode: 403,
        });

        expect(
          mockExecutarTransacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "cria fonte sem seed implícito e registra auditoria na mesma transação",
      async () => {
        repository.criarFonte
          .mockResolvedValue({
            id: 9,
            codigo:
              "mensageria_variavel",
            nome:
              "Mensageria variável",
            categoria:
              "comunicacao",
            ativa: true,
            obrigatoria_para_margem:
              true,
            created_at:
              "2026-09-23T22:00:00.000Z",
            updated_at:
              "2026-09-23T22:00:00.000Z",
          });

        const resultado =
          await service.criarFonte({
            payload: {
              codigo:
                "mensageria_variavel",
              nome:
                "Mensageria variável",
              categoria:
                "comunicacao",
              obrigatoriaParaMargem:
                true,
              motivo:
                "Contrato variável confirmado",
            },
            usuarioId: 7,
            superadmin: true,
          });

        expect(
          repository.criarFonte
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            codigo:
              "mensageria_variavel",
            obrigatoriaParaMargem:
              true,
          }),
          mockClient
        );

        expect(
          repository.registrarOperacao
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            usuarioId: 7,
            fonteId: 9,
            acao: "CRIAR_FONTE",
            motivo:
              "Contrato variável confirmado",
          }),
          mockClient
        );

        expect(resultado.fonte)
          .toMatchObject({
            id: 9,
            codigo:
              "mensageria_variavel",
          });
      }
    );

    test(
      "registra débito com ator e motivo no ledger e na auditoria",
      async () => {
        contributionEconomicsService
          .registrarCustoObservado
          .mockResolvedValue({
            id: 11,
            fonte_id: 9,
            negocio_id: 8,
            chave_origem:
              "wa_202609_8",
            tipo: "DEBITO",
            valor: "12.50",
            ocorrido_em:
              "2026-09-23T20:00:00.000Z",
            custo_referenciado_id:
              null,
            replay: false,
          });

        const resultado =
          await service.registrarCusto({
            payload: {
              fonteCodigo:
                "mensageria_variavel",
              negocioId: 8,
              chaveOrigem:
                "wa_202609_8",
              tipo: "debito",
              valor: 12.5,
              ocorridoEm:
                "2026-09-23T20:00:00Z",
              motivo:
                "Fechamento factual do provedor",
            },
            usuarioId: 7,
            superadmin: true,
          });

        expect(
          contributionEconomicsService
            .registrarCustoObservado
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            fonteCodigo:
              "mensageria_variavel",
            negocioId: 8,
            tipo: "DEBITO",
            valor: 12.5,
            detalhes:
              expect.objectContaining({
                origem:
                  "admin_wave31",
                motivo:
                  "Fechamento factual do provedor",
                registradoPorUsuarioId:
                  7,
              }),
          }),
          {
            executor:
              mockClient,
          }
        );

        expect(
          repository.registrarOperacao
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            acao:
              "REGISTRAR_CUSTO",
            custoId: 11,
            negocioId: 8,
          }),
          mockClient
        );

        expect(resultado.custo)
          .toMatchObject({
            id: 11,
            replay: false,
          });
      }
    );

    test(
      "não duplica auditoria em replay idempotente do mesmo custo",
      async () => {
        contributionEconomicsService
          .registrarCustoObservado
          .mockResolvedValue({
            id: 11,
            fonte_id: 9,
            negocio_id: 8,
            chave_origem:
              "wa_202609_8",
            tipo: "DEBITO",
            valor: "12.50",
            ocorrido_em:
              "2026-09-23T20:00:00.000Z",
            replay: true,
          });

        await service.registrarCusto({
          payload: {
            fonteCodigo:
              "mensageria_variavel",
            negocioId: 8,
            chaveOrigem:
              "wa_202609_8",
            tipo: "DEBITO",
            valor: 12.5,
            ocorridoEm:
              "2026-09-23T20:00:00Z",
            motivo:
              "Replay confirmado",
          },
          usuarioId: 7,
          superadmin: true,
        });

        expect(
          repository.registrarOperacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "crédito exige débito da mesma fonte e não pode ultrapassar o saldo",
      async () => {
        repository
          .validarCreditoDisponivel
          .mockResolvedValue({
            referenciaValida: true,
            saldoDisponivel: 5,
            excede: true,
          });

        await expect(
          service.registrarCusto({
            payload: {
              fonteCodigo:
                "mensageria_variavel",
              negocioId: 8,
              chaveOrigem:
                "credito_1",
              tipo: "CREDITO",
              valor: 6,
              ocorridoEm:
                "2026-09-23T21:00:00Z",
              custoReferenciadoId:
                11,
              motivo:
                "Estorno confirmado",
            },
            usuarioId: 7,
            superadmin: true,
          })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          contributionEconomicsService
            .registrarCustoObservado
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "replay de crédito não é bloqueado pelo saldo já consumido",
      async () => {
        repository
          .buscarCustoPorFonteChave
          .mockResolvedValue({
            id: 12,
          });

        contributionEconomicsService
          .registrarCustoObservado
          .mockResolvedValue({
            id: 12,
            fonte_id: 9,
            negocio_id: 8,
            chave_origem:
              "credito_replay",
            tipo: "CREDITO",
            valor: "4.00",
            ocorrido_em:
              "2026-09-23T21:00:00.000Z",
            custo_referenciado_id:
              11,
            replay: true,
          });

        const resultado =
          await service.registrarCusto({
            payload: {
              fonteCodigo:
                "mensageria_variavel",
              negocioId: 8,
              chaveOrigem:
                "credito_replay",
              tipo: "CREDITO",
              valor: 4,
              ocorridoEm:
                "2026-09-23T21:00:00Z",
              custoReferenciadoId:
                11,
              motivo:
                "Replay confirmado",
            },
            usuarioId: 7,
            superadmin: true,
          });

        expect(
          repository
            .validarCreditoDisponivel
        ).not.toHaveBeenCalled();

        expect(
          resultado.custo.replay
        ).toBe(true);
      }
    );

    test(
      "registra cobertura e sua justificativa de forma transacional",
      async () => {
        contributionEconomicsService
          .registrarCoberturaFonte
          .mockResolvedValue({
            fonte_id: 9,
            inicio_cobertura:
              "2026-09-01",
            coberto_ate:
              "2026-09-23",
            status:
              "COMPLETA",
            sincronizado_em:
              "2026-09-23T22:00:00.000Z",
          });

        await service
          .registrarCobertura({
            payload: {
              fonteCodigo:
                "mensageria_variavel",
              inicioCobertura:
                "2026-09-01",
              cobertoAte:
                "2026-09-23",
              status:
                "COMPLETA",
              motivo:
                "Conciliação concluída",
            },
            usuarioId: 7,
            superadmin: true,
          });

        expect(
          contributionEconomicsService
            .registrarCoberturaFonte
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            fonteCodigo:
              "mensageria_variavel",
            status:
              "COMPLETA",
          }),
          {
            executor:
              mockClient,
          }
        );

        expect(
          repository.registrarOperacao
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            fonteId: 9,
            acao:
              "ATUALIZAR_COBERTURA",
            motivo:
              "Conciliação concluída",
          }),
          mockClient
        );
      }
    );
  }
);
