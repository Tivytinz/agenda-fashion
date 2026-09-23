const crypto = require("crypto");
const db = require("../src/db/db");
const service = require(
  "../src/services/contributionEconomicsService"
);
const adminRepository = require(
  "../src/repositories/adminContributionEconomicsRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 29 - margem de contribuicao",
  () => {
    const negocios = [];
    const fontes = [];

    afterEach(async () => {
      for (
        const fonteId
        of fontes.splice(0)
      ) {
        await db.query(
          `
          DELETE FROM contribuicao_cobertura
          WHERE fonte_id = $1
          `,
          [fonteId]
        );

        await db.query(
          `
          DELETE FROM contribuicao_custos
          WHERE fonte_id = $1
          `,
          [fonteId]
        );

        await db.query(
          `
          DELETE FROM contribuicao_fontes
          WHERE id = $1
          `,
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
    });

    afterAll(() => db.end());

    async function prepararBase() {
      const id = suffix();

      const negocio = await db.query(
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
          `Contribuicao ${id}`,
          `wave-29-${id}`,
        ]
      );

      const negocioId = Number(
        negocio.rows[0].id
      );
      negocios.push(negocioId);

      const codigo =
        `fonte_wave29_${id}`;

      const fonte = await db.query(
        `
        INSERT INTO contribuicao_fontes (
          codigo,
          nome,
          categoria,
          obrigatoria_para_margem
        )
        VALUES (
          $1,
          'Fonte teste Wave 29',
          'variavel_atribuivel',
          TRUE
        )
        RETURNING id
        `,
        [codigo]
      );

      const fonteId = Number(
        fonte.rows[0].id
      );
      fontes.push(fonteId);

      const marco = await db.query(
        `
        SELECT TO_CHAR(
          (
            ocorrido_em
            AT TIME ZONE 'America/Sao_Paulo'
          )::date,
          'YYYY-MM-DD'
        ) AS data
        FROM financeiro_marcos
        WHERE chave =
          'margem_contribuicao_v1_inicio'
        LIMIT 1
        `
      );

      return {
        negocioId,
        codigo,
        dataInicio:
          marco.rows[0].data,
      };
    }

    test(
      "nao transforma fonte sem cobertura em custo zero",
      async () => {
        await prepararBase();

        const resumo =
          await adminRepository
            .buscarResumoContribuicao(
              "all"
            );

        expect(resumo)
          .toMatchObject({
            fontes_obrigatorias: 1,
            fontes_cobertas: 0,
            cobertura_completa: false,
            custos_variaveis_observados:
              null,
          });
      }
    );

    test(
      "persiste replay uma vez e soma debito menos credito somente com cobertura",
      async () => {
        const {
          negocioId,
          codigo,
          dataInicio,
        } = await prepararBase();

        const custo = {
          fonteCodigo: codigo,
          negocioId,
          chaveOrigem: "evt_debito",
          tipo: "DEBITO",
          valor: 12.5,
          ocorridoEm:
            `${dataInicio}T12:00:00-03:00`,
        };

        const primeiro =
          await service
            .registrarCustoObservado(
              custo
            );
        const replay =
          await service
            .registrarCustoObservado(
              custo
            );

        expect(primeiro.replay)
          .toBe(false);
        expect(replay.replay)
          .toBe(true);

        await expect(
          service
            .registrarCustoObservado({
              ...custo,
              valor: 13,
            })
        ).rejects.toThrow(
          "replay conflitante"
        );

        await service
          .registrarCustoObservado({
            fonteCodigo: codigo,
            negocioId,
            chaveOrigem:
              "evt_credito",
            tipo: "CREDITO",
            valor: 2.5,
            ocorridoEm:
              new Date().toISOString(),
          });

        const atual = await db.query(
          `
          SELECT TO_CHAR(
            (
              NOW()
              AT TIME ZONE 'America/Sao_Paulo'
            )::date,
            'YYYY-MM-DD'
          ) AS data
          `
        );
        const hoje =
          atual.rows[0].data;

        await service
          .registrarCoberturaFonte({
            fonteCodigo: codigo,
            inicioCobertura:
              dataInicio,
            cobertoAte: hoje,
            status: "COMPLETA",
          });

        const resumo =
          await adminRepository
            .buscarResumoContribuicao(
              "all"
            );

        expect(resumo)
          .toMatchObject({
            fontes_obrigatorias: 1,
            fontes_cobertas: 1,
            cobertura_completa: true,
            custos_variaveis_observados:
              "10.00",
          });

        const quantidade =
          await db.query(
            `
            SELECT COUNT(*)::INT AS total
            FROM contribuicao_custos
            WHERE fonte_id = $1
            `,
            [fontes[0]]
          );

        expect(
          quantidade.rows[0].total
        ).toBe(2);
      }
    );
  }
);
