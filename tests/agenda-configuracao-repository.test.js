jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
    executarTransacao:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);

describe(
  "agendaConfiguracaoRepository",
  () => {
    test(
      "bloqueia primeiro a agenda da dona antes de atualizar a política canônica",
      async () => {
        const executor = {
          query: jest.fn()
            .mockResolvedValueOnce({
              rows: [
                {
                  profissional_id:
                    7,
                },
              ],
            })
            .mockResolvedValueOnce({
              rows: [
                {
                  antecedencia_cancelamento:
                    24,
                },
              ],
            })
            .mockResolvedValue({
              rows: [],
            }),
        };

        await repository
          .atualizarPoliticaCancelamentoNegocio(
            11,
            24,
            executor
          );

        const consultas =
          executor.query.mock.calls
            .map(
              ([sql]) =>
                sql.replace(
                  /\s+/g,
                  " "
                )
            );

        expect(
          consultas[0]
        ).toContain(
          "FOR UPDATE OF ac"
        );
        expect(
          consultas[0]
        ).toContain(
          "un.papel = 'dono'"
        );
        expect(
          consultas[1]
        ).toContain(
          "UPDATE negocios"
        );
        expect(
          consultas[3]
        ).toContain(
          "UPDATE agenda_configuracoes"
        );
      }
    );
    test(
      "carrega configurações e horários da equipe em lote pelo negócio",
      async () => {
        db.query.mockResolvedValue({
          rows: [],
        });

        await repository
          .listarConfiguracoesHorariosNegocio({
            negocioId: 11,
            profissionalIds: [
              7,
              8,
              7,
            ],
          });

        const [
          sql,
          parametros,
        ] =
          db.query.mock.calls[
            db.query.mock.calls.length - 1
          ];

        expect(sql).toContain(
          "ac.negocio_id = $1"
        );
        expect(sql).toContain(
          "ANY($2::BIGINT[])"
        );
        expect(sql).toContain(
          "ah.negocio_id = ac.negocio_id"
        );
        expect(
          parametros
        ).toEqual([
          11,
          [
            7,
            8,
          ],
        ]);
      }
    );

  }
);
