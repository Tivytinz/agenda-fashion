const crypto = require("crypto");
const db = require("../src/db/db");
const service = require(
  "../src/services/adminContributionOperationsService"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 31 - fontes factuais de contribuição",
  () => {
    const usuarios = [];
    const negocios = [];
    const fontes = [];

    afterEach(async () => {
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

      for (
        const usuarioId
        of usuarios.splice(0)
      ) {
        await db.query(
          "DELETE FROM usuarios WHERE id = $1",
          [usuarioId]
        );
      }
    });

    afterAll(() => db.end());

    async function prepararBase() {
      const id = suffix();

      const usuario =
        await db.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp,
            ativo,
            email_verificado_em
          )
          VALUES (
            'Admin Wave 31',
            $1,
            'hash_teste_wave31',
            '62999999999',
            TRUE,
            NOW()
          )
          RETURNING id
          `,
          [
            `wave31_${id}@test.local`,
          ]
        );
      const usuarioId =
        Number(
          usuario.rows[0].id
        );
      usuarios.push(usuarioId);

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
            `Wave 31 ${id}`,
            `wave-31-${id}`,
          ]
        );
      const negocioId =
        Number(
          negocio.rows[0].id
        );
      negocios.push(negocioId);

      const codigo =
        `fonte_wave31_${id}`;

      const criada =
        await service.criarFonte({
          payload: {
            codigo,
            nome:
              "Fonte factual Wave 31",
            categoria:
              "variavel_atribuivel",
            obrigatoriaParaMargem:
              true,
            motivo:
              "Teste de fonte factual",
          },
          usuarioId,
          superadmin: true,
        });

      const fonteId =
        Number(
          criada.fonte.id
        );
      fontes.push(fonteId);

      return {
        usuarioId,
        negocioId,
        fonteId,
        codigo,
      };
    }

    test(
      "mantém custo idempotente, crédito limitado e cobertura auditável",
      async () => {
        const {
          usuarioId,
          negocioId,
          fonteId,
          codigo,
        } = await prepararBase();

        const ocorridoEm =
          new Date()
            .toISOString();

        const primeiro =
          await service
            .registrarCusto({
              payload: {
                fonteCodigo:
                  codigo,
                negocioId,
                chaveOrigem:
                  "debito_factual_1",
                tipo:
                  "DEBITO",
                valor: 10,
                ocorridoEm,
                motivo:
                  "Fatura variável confirmada",
              },
              usuarioId,
              superadmin: true,
            });

        const replay =
          await service
            .registrarCusto({
              payload: {
                fonteCodigo:
                  codigo,
                negocioId,
                chaveOrigem:
                  "debito_factual_1",
                tipo:
                  "DEBITO",
                valor: 10,
                ocorridoEm,
                motivo:
                  "Replay do mesmo fechamento",
              },
              usuarioId,
              superadmin: true,
            });

        expect(
          primeiro.custo.replay
        ).toBe(false);
        expect(
          replay.custo.replay
        ).toBe(true);

        await service
          .registrarCusto({
            payload: {
              fonteCodigo:
                codigo,
              negocioId,
              chaveOrigem:
                "credito_factual_1",
              tipo:
                "CREDITO",
              valor: 4,
              ocorridoEm:
                new Date()
                  .toISOString(),
              custoReferenciadoId:
                primeiro.custo.id,
              motivo:
                "Estorno parcial confirmado",
            },
            usuarioId,
            superadmin: true,
          });

        await expect(
          service
            .registrarCusto({
              payload: {
                fonteCodigo:
                  codigo,
                negocioId,
                chaveOrigem:
                  "credito_excedente",
                tipo:
                  "CREDITO",
                valor: 7,
                ocorridoEm:
                  new Date()
                    .toISOString(),
                custoReferenciadoId:
                  primeiro.custo.id,
                motivo:
                  "Tentativa acima do saldo",
              },
              usuarioId,
              superadmin: true,
            })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        const data = await db.query(
          `
          SELECT TO_CHAR(
            (
              NOW()
              AT TIME ZONE 'America/Sao_Paulo'
            )::date,
            'YYYY-MM-DD'
          ) AS hoje
          `
        );
        const hoje =
          data.rows[0].hoje;

        await service
          .registrarCobertura({
            payload: {
              fonteCodigo:
                codigo,
              inicioCobertura:
                hoje,
              cobertoAte:
                hoje,
              status:
                "COMPLETA",
              motivo:
                "Fechamento conciliado",
            },
            usuarioId,
            superadmin: true,
          });

        const painel =
          await service
            .buscarPainel({
              superadmin: true,
            });

        const fonte =
          painel.fontes.find(
            (item) =>
              item.id === fonteId
          );

        expect(fonte)
          .toMatchObject({
            codigo,
            coberturaStatus:
              "COMPLETA",
            lancamentos: 2,
            custoLiquidoObservado:
              6,
          });

        const auditoria =
          await db.query(
            `
            SELECT
              id,
              acao,
              motivo
            FROM contribuicao_operacoes_admin
            WHERE fonte_id = $1
            ORDER BY id ASC
            `,
            [fonteId]
          );

        expect(
          auditoria.rows.map(
            (item) =>
              item.acao
          )
        ).toEqual([
          "CRIAR_FONTE",
          "REGISTRAR_CUSTO",
          "REGISTRAR_CREDITO",
          "ATUALIZAR_COBERTURA",
        ]);

        await expect(
          db.query(
            `
            UPDATE contribuicao_operacoes_admin
            SET motivo = 'mutado'
            WHERE id = $1
            `,
            [
              auditoria
                .rows[0].id,
            ]
          )
        ).rejects.toThrow(
          /append-only/i
        );
      }
    );
  }
);
