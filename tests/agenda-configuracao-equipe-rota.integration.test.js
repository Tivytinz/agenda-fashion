jest.setTimeout(30000);

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    _res,
    next
  ) => {
    req.user = {
      id: Number(
        process.env
          .AF_TEST_AUTH_USER_ID
      ),
    };
    next();
  }
);

const express = require(
  "express"
);
const request = require(
  "supertest"
);
const db = require(
  "../src/db/db"
);
const agendaConfiguracaoRoutes = require(
  "../src/routes/agendaConfiguracaoRoutes"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require(
  "./helpers/cenarioAgendamento"
);

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );
  app.use(
    agendaConfiguracaoRoutes
  );
  app.use(
    (
      erro,
      _req,
      res,
      _next
    ) => {
      res
        .status(
          erro.statusCode ||
          erro.status ||
          500
        )
        .json({
          erro:
            erro.message,
        });
    }
  );

  return app;
}

function semanaTeste() {
  return Array.from(
    {
      length: 7,
    },
    (
      _valor,
      diaSemana
    ) => ({
      diaSemana,
      trabalha:
        diaSemana === 1,
      horaInicio:
        diaSemana === 1
          ? "09:00"
          : null,
      horaFim:
        diaSemana === 1
          ? "17:00"
          : null,
      intervaloInicio:
        null,
      intervaloFim:
        null,
    })
  );
}

describe(
  "agenda da equipe pela rota",
  () => {
    let negocioDona;
    let negocioExterno;
    let profissionalEquipeId;

    beforeEach(
      async () => {
        negocioDona =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "agenda-equipe-dona",
            }
          );

        negocioExterno =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "agenda-equipe-externo",
            }
          );

        const identificador =
          [
            "agenda-equipe",
            process.pid,
            Date.now(),
            Math.floor(
              Math.random() *
              1000000
            ),
          ].join("-");

        const usuario =
          await db.query(
            `
              INSERT INTO usuarios (
                nome,
                email,
                senha,
                whatsapp
              )
              VALUES (
                'Profissional Equipe',
                $1,
                'hash-teste-equipe',
                $2
              )
              RETURNING id
            `,
            [
              `${identificador}@teste.local`,
              `628${String(
                Date.now()
              ).slice(-8)}`,
            ]
          );

        profissionalEquipeId =
          Number(
            usuario.rows[0].id
          );

        await db.query(
          `
            INSERT INTO usuarios_negocios (
              usuario_id,
              negocio_id,
              papel,
              ativo
            )
            VALUES (
              $1,
              $2,
              'profissional',
              TRUE
            )
          `,
          [
            profissionalEquipeId,
            negocioDona.negocioId,
          ]
        );

        process.env
          .AF_TEST_AUTH_USER_ID =
          String(
            negocioDona
              .profissional.id
          );
      }
    );

    afterEach(
      async () => {
        delete process.env
          .AF_TEST_AUTH_USER_ID;

        if (
          negocioDona
        ) {
          await removerCenarioAgendamento(
            db,
            negocioDona
          );
        }

        if (
          negocioExterno
        ) {
          await removerCenarioAgendamento(
            db,
            negocioExterno
          );
        }

        if (
          profissionalEquipeId
        ) {
          await db.query(
            `
              DELETE FROM usuarios
              WHERE id = $1
            `,
            [
              profissionalEquipeId,
            ]
          );
        }
      }
    );

    afterAll(
      () => db.end()
    );

    test(
      "dona lê e salva a disponibilidade da profissional do próprio negócio",
      async () => {
        const app =
          criarApp();

        const leitura =
          await request(app)
            .get(
              `/agenda-configuracao?profissionalId=${profissionalEquipeId}`
            )
            .set(
              "X-AF-Contexto",
              "dono"
            );

        expect(
          leitura.statusCode
        ).toBe(200);
        expect(
          leitura.body
            .profissional
        ).toMatchObject({
          id:
            profissionalEquipeId,
          papel:
            "profissional",
        });

        const resposta =
          await request(app)
            .put(
              "/agenda-configuracao"
            )
            .set(
              "X-AF-Contexto",
              "dono"
            )
            .send({
              profissionalId:
                profissionalEquipeId,
              duracaoPadrao:
                60,
              intervaloMinutos:
                0,
              antecedenciaAgendamento:
                0,
              horarios:
                semanaTeste(),
            });

        expect(
          resposta.statusCode
        ).toBe(200);
        expect(
          resposta.body
            .configuracao
            .origem_horarios
        ).toBe(
          "personalizado"
        );

        const horarios =
          await db.query(
            `
              SELECT
                dia_semana,
                trabalha,
                hora_inicio::text
                  AS hora_inicio,
                hora_fim::text
                  AS hora_fim
              FROM agenda_horarios
              WHERE profissional_id = $1
                AND negocio_id = $2
              ORDER BY dia_semana
            `,
            [
              profissionalEquipeId,
              negocioDona.negocioId,
            ]
          );

        expect(
          horarios.rows
        ).toHaveLength(7);
        expect(
          horarios.rows[1]
        ).toMatchObject({
          dia_semana: 1,
          trabalha: true,
          hora_inicio:
            "09:00:00",
          hora_fim:
            "17:00:00",
        });
        expect(
          horarios.rows[2]
            .trabalha
        ).toBe(false);

        const agendaDona =
          await db.query(
            `
              SELECT
                hora_inicio::text
                  AS hora_inicio,
                hora_fim::text
                  AS hora_fim
              FROM agenda_horarios
              WHERE profissional_id = $1
                AND negocio_id = $2
                AND dia_semana = 1
            `,
            [
              negocioDona
                .profissional.id,
              negocioDona.negocioId,
            ]
          );

        expect(
          agendaDona.rows[0]
        ).not.toMatchObject({
          hora_inicio:
            "09:00:00",
          hora_fim:
            "17:00:00",
        });
      }
    );

    test(
      "dona não consegue alterar agenda de profissional de outro negócio",
      async () => {
        const app =
          criarApp();

        const resposta =
          await request(app)
            .put(
              "/agenda-configuracao"
            )
            .set(
              "X-AF-Contexto",
              "dono"
            )
            .send({
              profissionalId:
                negocioExterno
                  .profissional.id,
              duracaoPadrao:
                60,
              intervaloMinutos:
                0,
              antecedenciaAgendamento:
                0,
              horarios:
                semanaTeste(),
            });

        expect(
          resposta.statusCode
        ).toBe(404);
        expect(
          resposta.body.erro
        ).toMatch(
          /Profissional ativo não encontrado/
        );

        const vazamento =
          await db.query(
            `
              SELECT COUNT(*)::INT
                AS total
              FROM agenda_horarios
              WHERE profissional_id = $1
                AND negocio_id = $2
            `,
            [
              negocioExterno
                .profissional.id,
              negocioDona.negocioId,
            ]
          );

        expect(
          vazamento.rows[0]
            .total
        ).toBe(0);
      }
    );
  }
);
