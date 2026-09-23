const crypto = require(
  "crypto"
);

const mockAdapter = {
  nome:
    "Adaptador factual teste",
  coletar:
    jest.fn(),
};

jest.mock(
  "../src/services/contributionCostProviderRegistry",
  () => ({
    codigoAdaptador:
      (valor) =>
        String(valor || "")
          .trim()
          .toLowerCase(),
    listarAdaptadores:
      () => [
        {
          codigo:
            "provider_test",
          nome:
            "Adaptador factual teste",
          disponivel: true,
        },
      ],
    obterAdaptador:
      (codigo) =>
        codigo ===
          "provider_test"
          ? mockAdapter
          : null,
  })
);

const db = require(
  "../src/db/db"
);
const service = require(
  "../src/services/contributionCostSyncService"
);

function suffix() {
  return crypto
    .randomUUID()
    .replaceAll(
      "-",
      ""
    )
    .slice(0, 12);
}

describe(
  "Wave 32 - sincronização factual de contribuição",
  () => {
    const integracoes = [];
    const fontes = [];
    const negocios = [];

    afterEach(
      async () => {
        for (
          const integracaoId
          of integracoes.splice(0)
        ) {
          await db.query(
            "DELETE FROM contribuicao_sincronizacoes WHERE integracao_id = $1",
            [integracaoId]
          );
          await db.query(
            "DELETE FROM contribuicao_integracoes_sync WHERE id = $1",
            [integracaoId]
          );
        }

        for (
          const fonteId
          of fontes.splice(0)
        ) {
          await db.query(
            "DELETE FROM contribuicao_cobertura WHERE fonte_id = $1",
            [fonteId]
          );
          await db.query(
            "DELETE FROM contribuicao_custos WHERE fonte_id = $1",
            [fonteId]
          );
          await db.query(
            "DELETE FROM contribuicao_fontes WHERE id = $1",
            [fonteId]
          );
        }

        for (
          const negocioId
          of negocios.splice(0)
        ) {
          await db.query(
            "DELETE FROM negocios WHERE id = $1",
            [negocioId]
          );
        }

        mockAdapter
          .coletar
          .mockReset();
      }
    );

    afterAll(
      () => db.end()
    );

    async function preparar() {
      const token =
        suffix();

      const negocio =
        await db.query(
          `
          INSERT INTO negocios (
            nome,
            slug,
            setor,
            whatsapp,
            cidade,
            estado,
            publicado
          )
          VALUES (
            $1,
            $2,
            'unhas',
            '62999999999',
            'Goiânia',
            'GO',
            TRUE
          )
          RETURNING id
          `,
          [
            `Wave 32 ${token}`,
            `wave-32-${token}`,
          ]
        );

      const negocioId =
        Number(
          negocio.rows[0].id
        );
      negocios.push(
        negocioId
      );

      const fonte =
        await db.query(
          `
          INSERT INTO contribuicao_fontes (
            codigo,
            nome,
            categoria,
            obrigatoria_para_margem
          )
          VALUES (
            $1,
            'Fonte Wave 32',
            'variavel_atribuivel',
            TRUE
          )
          RETURNING id, codigo
          `,
          [
            `wave32_${token}`,
          ]
        );

      const fonteId =
        Number(
          fonte.rows[0].id
        );
      fontes.push(
        fonteId
      );

      const criada =
        await service
          .criarIntegracao({
            payload: {
              fonteId,
              adaptador:
                "provider_test",
              intervaloMinutos: 60,
              ativa: true,
            },
            superadmin: true,
          });

      const integracaoId =
        Number(
          criada
            .integracao.id
        );
      integracoes.push(
        integracaoId
      );

      const datas =
        await db.query(
          `
          SELECT
            TO_CHAR(
              (
                NOW()
                AT TIME ZONE
                  'America/Sao_Paulo'
              )::date,
              'YYYY-MM-DD'
            ) AS hoje,
            TO_CHAR(
              (
                NOW()
                AT TIME ZONE
                  'America/Sao_Paulo'
              )::date - 1,
              'YYYY-MM-DD'
            ) AS ontem
          `
        );

      return {
        negocioId,
        fonteId,
        fonteCodigo:
          fonte.rows[0].codigo,
        integracaoId,
        hoje:
          datas.rows[0].hoje,
        ontem:
          datas.rows[0].ontem,
      };
    }

    test(
      "persiste ledger, cobertura e cursor atomicamente e tolera replay",
      async () => {
        const base =
          await preparar();
        const ocorridoEm =
          new Date(
            `${base.ontem}T15:00:00.000Z`
          ).toISOString();

        mockAdapter
          .coletar
          .mockResolvedValueOnce({
            itens: [
              {
                chaveOrigem:
                  "provider_evt_1",
                negocioId:
                  base.negocioId,
                tipo: "DEBITO",
                valor: 12.5,
                ocorridoEm,
              },
            ],
            cobertura: {
              inicioCobertura:
                base.ontem,
              cobertoAte:
                base.hoje,
              status:
                "COMPLETA",
            },
            proximoCursor: {
              pagina: 1,
            },
          })
          .mockResolvedValueOnce({
            itens: [
              {
                chaveOrigem:
                  "provider_evt_1",
                negocioId:
                  base.negocioId,
                tipo: "DEBITO",
                valor: 12.5,
                ocorridoEm,
              },
            ],
            cobertura: {
              inicioCobertura:
                base.ontem,
              cobertoAte:
                base.hoje,
              status:
                "COMPLETA",
            },
            proximoCursor: {
              pagina: 2,
            },
          });

        const primeira =
          await service
            .sincronizarIntegracao({
              integracaoId:
                base
                  .integracaoId,
            });

        const segunda =
          await service
            .sincronizarIntegracao({
              integracaoId:
                base
                  .integracaoId,
            });

        expect(primeira)
          .toMatchObject({
            itensImportados: 1,
            itensReplay: 0,
          });
        expect(segunda)
          .toMatchObject({
            itensImportados: 0,
            itensReplay: 1,
          });

        const custos =
          await db.query(
            `
            SELECT
              chave_origem,
              valor,
              tipo
            FROM contribuicao_custos
            WHERE fonte_id = $1
            `,
            [base.fonteId]
          );

        expect(
          custos.rows
        ).toHaveLength(1);
        expect(
          custos.rows[0]
        ).toMatchObject({
          chave_origem:
            "provider_evt_1",
          valor: "12.50",
          tipo: "DEBITO",
        });

        const cobertura =
          await db.query(
            `
            SELECT
              inicio_cobertura,
              coberto_ate,
              status
            FROM contribuicao_cobertura
            WHERE fonte_id = $1
            `,
            [base.fonteId]
          );

        expect(
          cobertura.rows[0]
            .status
        ).toBe("COMPLETA");

        const integracao =
          await db.query(
            `
            SELECT
              cursor,
              ultimo_sucesso_em,
              ultimo_erro_codigo
            FROM contribuicao_integracoes_sync
            WHERE id = $1
            `,
            [
              base
                .integracaoId,
            ]
          );

        expect(
          integracao.rows[0]
            .cursor
        ).toEqual({
          pagina: 2,
        });
        expect(
          integracao.rows[0]
            .ultimo_sucesso_em
        ).not.toBeNull();
        expect(
          integracao.rows[0]
            .ultimo_erro_codigo
        ).toBeNull();

        const execucoes =
          await db.query(
            `
            SELECT
              status,
              itens_importados,
              itens_replay
            FROM contribuicao_sincronizacoes
            WHERE integracao_id = $1
            ORDER BY id ASC
            `,
            [
              base
                .integracaoId,
            ]
          );

        expect(
          execucoes.rows
        ).toHaveLength(2);
        expect(
          execucoes.rows[0]
        ).toMatchObject({
          status: "SUCESSO",
          itens_importados: 1,
          itens_replay: 0,
        });
        expect(
          execucoes.rows[1]
        ).toMatchObject({
          status: "SUCESSO",
          itens_importados: 0,
          itens_replay: 1,
        });
      }
    );

    test(
      "encerra tentativa abandonada antes de uma nova sincronização",
      async () => {
        const base =
          await preparar();

        const abandonada =
          await db.query(
            `
            INSERT INTO contribuicao_sincronizacoes (
              integracao_id,
              status,
              cursor_entrada
            )
            VALUES (
              $1,
              'EXECUTANDO',
              '{}'::jsonb
            )
            RETURNING id
            `,
            [
              base
                .integracaoId,
            ]
          );

        mockAdapter
          .coletar
          .mockResolvedValue({
            itens: [],
            cobertura: null,
            proximoCursor: {
              pagina: 1,
            },
          });

        await service
          .sincronizarIntegracao({
            integracaoId:
              base.integracaoId,
          });

        const antiga =
          await db.query(
            `
            SELECT
              status,
              erro_codigo,
              finalizado_em
            FROM contribuicao_sincronizacoes
            WHERE id = $1
            `,
            [
              abandonada
                .rows[0].id,
            ]
          );

        expect(
          antiga.rows[0]
        ).toMatchObject({
          status: "ERRO",
          erro_codigo:
            "execucao_abandonada",
        });
        expect(
          antiga.rows[0]
            .finalizado_em
        ).not.toBeNull();
      }
    );

    test(
      "falha de validação não avança cursor nem cobertura",
      async () => {
        const base =
          await preparar();

        mockAdapter
          .coletar
          .mockResolvedValue({
            itens: [
              {
                chaveOrigem:
                  "evt_futuro",
                negocioId:
                  base.negocioId,
                tipo: "DEBITO",
                valor: 10,
                ocorridoEm:
                  "2099-01-01T00:00:00.000Z",
              },
            ],
            cobertura: {
              inicioCobertura:
                base.hoje,
              cobertoAte:
                "2099-01-01",
              status:
                "COMPLETA",
            },
            proximoCursor: {
              pagina: 99,
            },
          });

        await expect(
          service
            .sincronizarIntegracao({
              integracaoId:
                base
                  .integracaoId,
            })
        ).rejects.toBeDefined();

        const integracao =
          await db.query(
            `
            SELECT
              cursor,
              ultimo_erro_codigo
            FROM contribuicao_integracoes_sync
            WHERE id = $1
            `,
            [
              base
                .integracaoId,
            ]
          );

        expect(
          integracao.rows[0]
            .cursor
        ).toEqual({});
        expect(
          integracao.rows[0]
            .ultimo_erro_codigo
        ).not.toBeNull();

        const cobertura =
          await db.query(
            `
            SELECT COUNT(*)::INT
              AS total
            FROM contribuicao_cobertura
            WHERE fonte_id = $1
            `,
            [base.fonteId]
          );

        expect(
          cobertura.rows[0]
            .total
        ).toBe(0);
      }
    );
  }
);
