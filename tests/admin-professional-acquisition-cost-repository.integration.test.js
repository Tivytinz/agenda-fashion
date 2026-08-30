const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalAcquisitionCostRepository"
);

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminProfessionalAcquisitionCostRepository integrado",
  () => {
    let campanhaProfissionalId;
    let campanhaClienteId;

    beforeEach(async () => {
      const suffix = idCurto();

      const profissional = await db.query(
        `
        INSERT INTO marketing_campanhas (
          nome,
          canal,
          objetivo,
          utm_source,
          utm_medium,
          utm_campaign,
          destino_path,
          ativo
        )
        VALUES (
          $1,
          'google',
          'profissional',
          'google',
          'cpc',
          $2,
          '/para-profissionais',
          TRUE
        )
        RETURNING id
        `,
        [
          `Profissional ${suffix}`,
          `prof_${suffix}`,
        ]
      );

      const cliente = await db.query(
        `
        INSERT INTO marketing_campanhas (
          nome,
          canal,
          objetivo,
          utm_source,
          utm_medium,
          utm_campaign,
          destino_path,
          ativo
        )
        VALUES (
          $1,
          'meta',
          'cliente',
          'meta',
          'cpc',
          $2,
          '/',
          TRUE
        )
        RETURNING id
        `,
        [
          `Cliente ${suffix}`,
          `cli_${suffix}`,
        ]
      );

      campanhaProfissionalId = Number(
        profissional.rows[0].id
      );
      campanhaClienteId = Number(
        cliente.rows[0].id
      );

      await db.query(
        `
        INSERT INTO marketing_campanha_gastos (
          campanha_id,
          data_gasto,
          valor_centavos,
          moeda,
          fonte
        )
        VALUES
          (
            $1,
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
            5000,
            'BRL',
            'manual'
          ),
          (
            $1,
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 1,
            2000,
            'BRL',
            'manual'
          ),
          (
            $2,
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
            9000,
            'BRL',
            'manual'
          )
        `,
        [
          campanhaProfissionalId,
          campanhaClienteId,
        ]
      );
    });

    afterEach(async () => {
      const ids = [
        campanhaProfissionalId,
        campanhaClienteId,
      ].filter(Number.isFinite);

      await db.query(
        `
        DELETE FROM marketing_campanha_gastos
        WHERE campanha_id = ANY($1::bigint[])
        `,
        [ids]
      );

      await db.query(
        `
        DELETE FROM marketing_campanhas
        WHERE id = ANY($1::bigint[])
        `,
        [ids]
      );
    });

    test(
      "soma somente gasto de campanhas profissionais dentro do periodo",
      async () => {
        const hoje =
          await repository
            .listarInvestimentos("today");
        const profissionalHoje =
          hoje.linhas.find(
            (linha) =>
              Number(linha.campanha_id) ===
              campanhaProfissionalId
          );

        expect(hoje.periodo).toBe("today");
        expect(profissionalHoje)
          .toMatchObject({
            objetivo: "profissional",
            utm_source: "google",
            investimento_centavos: "5000",
            dias_com_gasto: 1,
          });
        expect(
          hoje.linhas.some(
            (linha) =>
              Number(linha.campanha_id) ===
              campanhaClienteId
          )
        ).toBe(false);

        const todoPeriodo =
          await repository
            .listarInvestimentos("all");
        const profissionalAll =
          todoPeriodo.linhas.find(
            (linha) =>
              Number(linha.campanha_id) ===
              campanhaProfissionalId
          );

        expect(profissionalAll)
          .toMatchObject({
            investimento_centavos: "7000",
            dias_com_gasto: 2,
          });
      }
    );

    test(
      "lista gasto diario com idade local e exclui campanha de cliente",
      async () => {
        const dataHoje = await db.query(
          `
          SELECT
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::text
              AS hoje
          `
        );
        const hojeLocal =
          dataHoje.rows[0].hoje;
        const resultado =
          await repository
            .listarInvestimentosDiarios("all");
        const linhasProfissionais =
          resultado.linhas.filter(
            (linha) =>
              Number(linha.campanha_id) ===
              campanhaProfissionalId
          );
        const hoje =
          linhasProfissionais.find(
            (linha) =>
              linha.data_gasto === hojeLocal
          );
        const ontem =
          linhasProfissionais.find(
            (linha) =>
              Number(linha.idade_dias) === 1
          );

        expect(resultado.periodo).toBe("all");
        expect(linhasProfissionais)
          .toHaveLength(2);
        expect(hoje).toMatchObject({
          objetivo: "profissional",
          investimento_centavos: "5000",
          idade_dias: 0,
        });
        expect(ontem).toMatchObject({
          investimento_centavos: "2000",
          idade_dias: 1,
        });
        expect(
          resultado.linhas.some(
            (linha) =>
              Number(linha.campanha_id) ===
              campanhaClienteId
          )
        ).toBe(false);
      }
    );

    test(
      "normaliza periodo invalido para 30 dias",
      async () => {
        const resultado =
          await repository
            .listarInvestimentos("invalido");
        const diarios =
          await repository
            .listarInvestimentosDiarios(
              "invalido"
            );

        expect(resultado.periodo).toBe("30");
        expect(diarios.periodo).toBe("30");
      }
    );
  }
);
