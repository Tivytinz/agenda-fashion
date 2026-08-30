jest.setTimeout(30000);

const request = require(
  "supertest"
);

const app = require(
  "../src/server"
);

const db = require(
  "../src/db/db"
);

const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require(
  "./helpers/cenarioAgendamento"
);

let cenario;

describe(
  "Publicação obrigatória no agendamento público",
  () => {
    beforeAll(
      async () => {
        cenario =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "teste-publicacao-publica",
            }
          );

        await db.query(
          `
            UPDATE negocios
            SET publicado = FALSE
            WHERE id = $1
          `,
          [cenario.negocioId]
        );
      },
      60000
    );

    afterAll(
      async () => {
        try {
          await removerCenarioAgendamento(
            db,
            cenario
          );
        } finally {
          if (
            typeof db.end ===
            "function"
          ) {
            await db.end();
          }
        }
      },
      60000
    );

    test(
      "não lista horários de negócio não publicado mesmo com agenda confirmada",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/agenda-publica"
            )
            .query({
              slug:
                cenario.slug,
              servicoId:
                cenario.servico.id,
              profissionalId:
                cenario.profissional.id,
            });

        expect(
          resposta.statusCode
        ).toBe(404);

        expect(
          resposta.body
        ).toMatchObject({
          erro:
            "Negócio não encontrado.",
        });
      }
    );

    test(
      "não cria agendamento direto de negócio não publicado",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send({
              slug:
                cenario.slug,
              servico_id:
                cenario.servico.id,
              profissional_id:
                cenario.profissional.id,
              data:
                "2099-01-05",
              horario:
                "08:00",
              cliente_nome:
                "Cliente Teste",
              cliente_whatsapp:
                "62999999999",
            });

        expect(
          resposta.statusCode
        ).toBe(404);

        expect(
          resposta.body
        ).toMatchObject({
          erro:
            "Negócio não encontrado.",
        });
      }
    );
  }
);
