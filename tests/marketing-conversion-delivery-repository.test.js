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

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingConversionDeliveryRepository"
);

describe(
  "Fila persistente de conversões de marketing",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClient.query.mockReset();
    });

    test(
      "não cria nova entrega quando o evento financeiro já foi enviado",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 7,
                provedor: "google",
                tipo_evento:
                  "SUBSCRIPTION_ACTIVATED",
                chave_evento:
                  "assinatura-evento:90",
                assinatura_evento_id: 90,
                status: "SENT",
                payload: {
                  assinaturaId: 11,
                  pagamentoId: "pay_1",
                  assinaturaEventoId: 90
                }
              },
              {
                id: 8,
                provedor: "google",
                tipo_evento:
                  "SUBSCRIPTION_ACTIVATED",
                chave_evento:
                  "assinatura:11",
                assinatura_evento_id: null,
                status: "PENDING",
                payload: {
                  assinaturaId: 11,
                  pagamentoId: "pay_1"
                }
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        const resultado =
          await repository.enfileirar({
            provedor: "google",
            tipoEvento:
              "SUBSCRIPTION_ACTIVATED",
            assinaturaEventoId: 90,
            ocorridoEm:
              "2026-10-06T12:00:00.000Z",
            payload: {
              negocioId: 7,
              assinaturaId: 11,
              pagamentoId: "pay_1",
              assinaturaEventoId: 90,
              valor: 59.9
            }
          });

        expect(resultado).toMatchObject({
          novo: false,
          rearmado: false,
          entrega: {
            id: 7,
            status: "SENT"
          }
        });
        expect(
          mockClient.query.mock.calls[2][0]
        ).toContain(
          "DUPLICADA_LEGADA"
        );
      }
    );

    test(
      "não substitui o payload de um evento financeiro por outro pagamento",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 9,
                chave_evento:
                  "assinatura-evento:90",
                assinatura_evento_id: 90,
                status: "FAILED",
                tentativas: 5,
                payload: {
                  assinaturaId: 11,
                  pagamentoId: "pay_original",
                  assinaturaEventoId: 90
                }
              }
            ]
          });

        const resultado =
          await repository.enfileirar({
            provedor: "meta",
            tipoEvento:
              "SUBSCRIPTION_ACTIVATED",
            assinaturaEventoId: 90,
            ocorridoEm:
              "2026-10-06T12:00:00.000Z",
            payload: {
              negocioId: 7,
              assinaturaId: 11,
              pagamentoId: "pay_novo",
              assinaturaEventoId: 90,
              valor: 59.9
            }
          });

        expect(resultado).toMatchObject({
          novo: false,
          rearmado: false,
          entrega: {
            id: 9,
            status: "FAILED",
            payload: {
              pagamentoId:
                "pay_original"
            }
          }
        });
        expect(
          mockClient.query
        ).toHaveBeenCalledTimes(2);
      }
    );

    test(
      "resume a saúde operacional das entregas por provedor e status",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              provedor: "google",
              status: "FAILED",
              total: 2,
              falhas_terminais: 1,
              processamentos_expirados: 0
            }
          ]
        });

        await expect(
          repository.buscarSaudeEntregas("7")
        ).resolves.toEqual({
          periodo: "7",
          linhas: expect.any(Array)
        });

        const sql = db.query.mock.calls[0][0];

        expect(sql).toContain(
          "tipo_evento = 'SUBSCRIPTION_ACTIVATED'"
        );
        expect(sql).toContain(
          "proxima_tentativa_em IS NULL"
        );
        expect(sql).toContain(
          "bloqueado_em < NOW() - INTERVAL '5 minutes'"
        );
        expect(sql).toContain(
          "GROUP BY provedor, status"
        );
        expect(sql).toContain(
          "created_at >= NOW() - INTERVAL '7 days'"
        );
      }
    );

    test(
      "reconcilia conversao inicial paga com Google e Meta sem reconstruir consentimento atual",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              provedor: "google",
              conversoes_pagas: 4,
              enviadas: 2,
              inelegiveis_legitimas: 1,
              sem_entrega: 1
            }
          ]
        });

        await expect(
          repository.buscarReconciliacaoConversoes("30")
        ).resolves.toEqual({
          periodo: "30",
          provedores: expect.any(Array)
        });

        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain("WITH conversoes_canonicas AS");
        expect(sql).toContain("ae.tipo = 'CONVERSAO_INICIAL'");
        expect(sql).toContain("pg.data_pagamento IS NOT NULL");
        expect(sql).toContain("FROM conversoes_canonicas");
        expect(sql).toContain("(NOW() - INTERVAL '30 days')::date");
        expect(sql).toContain("pg.confirmacao_observada_em");
        expect(sql).toContain("entrega.assinatura_evento_id");
        expect(sql).toContain("'SEM_CONSENTIMENTO'");
        expect(sql).toContain("'INTEGRACAO_DESABILITADA'");
        expect(sql).toContain("'DIVERGENCIA_FINANCEIRA'");
        expect(sql).not.toContain("marketing_usuario_atribuicoes");
      }
    );

    test(
      "rearmazena somente falha terminal de integração do provedor restaurado",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 12,
              provedor: "google",
              status: "PENDING",
              tentativas: 0
            }
          ]
        });

        const resultado =
          await repository
            .rearmarIntegracaoDisponivel(
              "google"
            );

        expect(resultado)
          .toHaveLength(1);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "resultado_codigo ="
        );
        expect(sql).toContain(
          "'INTEGRACAO_DESABILITADA'"
        );
        expect(sql).toContain(
          "status = 'PENDING'"
        );
        expect(sql).toContain(
          "tentativas = 0"
        );
        expect(parametros)
          .toEqual(["google"]);
      }
    );

    test(
      "reserva com SKIP LOCKED, limita a cinco tentativas e só repete FAILED agendado",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .reservarProximo();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "FOR UPDATE SKIP LOCKED"
        );
        expect(
          sql.match(/tentativas < 5/g)
        ).toHaveLength(3);
        expect(sql).toContain(
          "proxima_tentativa_em IS NOT NULL"
        );
        expect(sql).toContain(
          "proxima_tentativa_em <= NOW()"
        );
      }
    );

    test(
      "finalização usa lease e reconcilia tentativa terminal antiga",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarEnviado(9, 5);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5
        ]);
      }
    );

    test(
      "resultado ignorado também reconcilia a mesma tentativa terminal",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarIgnorado(
            9,
            5,
            "sem_consentimento"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5,
          "sem_consentimento",
          "IGNORADO"
        ]);
      }
    );

    test(
      "quinta falha não agenda uma sexta tentativa",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalha(
            9,
            5,
            "falha externa"
          );

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "WHEN tentativas < 5"
        );
        expect(sql).toContain(
          "THEN 'FALHA_TEMPORARIA'"
        );
        expect(sql).toContain(
          "ELSE 'FALHA_TECNICA'"
        );
        expect(sql).toContain(
          "ELSE NULL"
        );
      }
    );

    test(
      "falha técnica terminal não fica elegível a retry",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalhaTerminal(
            9,
            2,
            "event_id_invalido"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "proxima_tentativa_em = NULL"
        );
        expect(sql).toContain(
          "status = 'PROCESSING'"
        );
        expect(sql).not.toContain(
          "WHEN tentativas < 5"
        );
        expect(parametros).toEqual([
          9,
          2,
          "event_id_invalido",
          "FALHA_TECNICA"
        ]);
      }
    );
  }
);
