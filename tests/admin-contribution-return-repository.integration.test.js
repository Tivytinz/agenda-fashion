const db = require("../src/db/db");
const repository = require(
  "../src/repositories/adminContributionReturnRepository"
);

describe(
  "Wave 30 - prontidão do retorno de contribuição",
  () => {
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
          DELETE FROM contribuicao_fontes
          WHERE id = $1
          `,
          [fonteId]
        );
      }
    });

    afterAll(() => db.end());

    test(
      "migration 101 cria cutover sem inventar fonte de custo",
      async () => {
        const prontidao =
          await repository
            .buscarProntidao();

        expect(
          prontidao
            .inicio_cobertura_wave30
        ).not.toBeNull();

        expect(
          Number(
            prontidao
              .fontes_obrigatorias
          )
        ).toBe(0);

        expect(
          prontidao
            .cobertura_contribuicao_completa_hoje
        ).toBe(false);
      }
    );

    test(
      "só considera contribuição coberta quando a fonte obrigatória alcança hoje",
      async () => {
        const codigo =
          `wave30_${Date.now()}`;

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
            'Fonte Wave 30',
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

        await db.query(
          `
          INSERT INTO contribuicao_cobertura (
            fonte_id,
            inicio_cobertura,
            coberto_ate,
            status
          )
          VALUES (
            $1,
            CURRENT_DATE,
            CURRENT_DATE,
            'COMPLETA'
          )
          `,
          [fonteId]
        );

        const prontidao =
          await repository
            .buscarProntidao();

        expect(
          Number(
            prontidao
              .fontes_obrigatorias
          )
        ).toBe(1);
        expect(
          Number(
            prontidao
              .fontes_cobertas_ate_hoje
          )
        ).toBe(1);
        expect(
          prontidao
            .cobertura_contribuicao_completa_hoje
        ).toBe(true);
      }
    );
  }
);
