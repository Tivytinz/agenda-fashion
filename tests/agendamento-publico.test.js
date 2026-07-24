jest.setTimeout(30000);

const request = require(
  "supertest"
);

const jwt = require(
  "jsonwebtoken"
);

const app = require(
  "../src/server"
);

const SLUG_NEGOCIO =
  "victor";

function gerarSufixoUnico() {
  return (
    `${Date.now()}` +
    `${Math.floor(
      Math.random() * 10000
    )}`
  );
}

function gerarWhatsappValido() {
  const final =
    String(Date.now())
      .slice(-8);

  return `629${final}`;
}

async function buscarHorarioDisponivel() {
  const perfil =
    await request(app)
      .get(
        `/perfil-negocio/${SLUG_NEGOCIO}`
      );

      expect(
    perfil.statusCode
  ).toBe(200);

  expect(
    Array.isArray(
      perfil.body.servicos
    )
  ).toBe(true);

  expect(
    Array.isArray(
      perfil.body.profissionais
    )
  ).toBe(true);

  expect(
    perfil.body.servicos.length
  ).toBeGreaterThan(0);

  expect(
    perfil.body.profissionais.length
  ).toBeGreaterThan(0);

  const servico =
    perfil.body.servicos[0];

  const profissional =
    perfil.body.profissionais[0];

  const agenda =
    await request(app)
      .get(
        "/agenda-publica"
      )
      .query({
        slug:
          SLUG_NEGOCIO,

        servicoId:
          servico.id,

        profissionalId:
          profissional.id,
      });
  expect(
    agenda.statusCode
  ).toBe(200);

  expect(
    Array.isArray(
      agenda.body.disponibilidade
    )
  ).toBe(true);

  const diaComHorario =
    agenda.body.disponibilidade
      .find(
        (dia) =>
          Array.isArray(
            dia.horarios
          ) &&
          dia.horarios.length > 0
      );

  expect(
    diaComHorario
  ).toBeTruthy();

  return {
    servico,
    profissional,

    data:
      diaComHorario.data,

    horario:
      diaComHorario
        .horarios[0],
  };
}

describe(
  "Fluxo de agendamento público",
  () => {
    test(
      "visitante consegue abrir o perfil e agendar",
      async () => {
        const {
          servico,
          profissional,
          data,
          horario,
        } =
          await buscarHorarioDisponivel();

        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send({
              slug:
                SLUG_NEGOCIO,

              servico_id:
                servico.id,

              profissional_id:
                profissional.id,

              data,
              horario,

              cliente_nome:
                "Visitante Teste",

              cliente_whatsapp:
                gerarWhatsappValido(),
            });

        expect(
          resposta.statusCode
        ).toBe(201);

        expect(
          resposta.body
        ).toHaveProperty(
          "agendamento"
        );

        expect(
          resposta.body
            .agendamento
            .id
        ).toBeTruthy();
      }
    );

    test(
      "conta autenticada agenda com JWT contendo somente id",
      async () => {
        const sufixo =
          gerarSufixoUnico();

        const usuario = {
          nome:
            "Cliente Autenticado",

          email:
            `cliente.${sufixo}@teste.com`,

          senha:
            "Teste@12345",

          whatsapp:
            gerarWhatsappValido(),
        };

        const cadastro =
          await request(app)
            .post(
              "/cadastro"
            )
            .send(
              usuario
            );

        expect(
          cadastro.statusCode
        ).toBe(201);

        expect(
          typeof cadastro.body.token
        ).toBe(
          "string"
        );

        expect(
          cadastro.body.token.length
        ).toBeGreaterThan(20);

        const token =
          cadastro.body.token;

        const payload =
          jwt.decode(token);

        expect(
          payload
        ).toBeTruthy();

        expect(
          Number(payload.id)
        ).toBeGreaterThan(0);

        /*
         * Esta é a regra principal
         * do novo modelo de autenticação.
         */
        expect(
          payload
        ).not.toHaveProperty(
          "tipo"
        );

        const {
          servico,
          profissional,
          data,
          horario,
        } =
          await buscarHorarioDisponivel();

        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              slug:
                SLUG_NEGOCIO,

              servico_id:
                servico.id,

              profissional_id:
                profissional.id,

              data,
              horario,

              cliente_nome:
                usuario.nome,

              cliente_whatsapp:
                usuario.whatsapp,
            });

        expect(
          resposta.statusCode
        ).toBe(201);

        expect(
          resposta.statusCode
        ).not.toBe(403);

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Agendamento criado com sucesso.",
        });

        expect(
          resposta.body
            .agendamento
            .id
        ).toBeTruthy();

        const agendamentoId =
          resposta.body
            .agendamento
            .id;

        /*
         * Confirma que o agendamento
         * foi associado ao usuario.id
         * da conta autenticada.
         */
        const meusAgendamentos =
          await request(app)
            .get(
              "/meus-agendamentos"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          meusAgendamentos
            .statusCode
        ).toBe(200);

        expect(
          Array.isArray(
            meusAgendamentos
              .body
              .agendamentos
          )
        ).toBe(true);

        const agendamentoCriado =
          meusAgendamentos
            .body
            .agendamentos
            .find(
              (item) =>
                Number(item.id) ===
                Number(
                  agendamentoId
                )
            );

        expect(
          agendamentoCriado
        ).toBeTruthy();

        expect(
          agendamentoCriado
        ).toMatchObject({
          id:
            agendamentoId,

          servico:
            servico.nome,

          profissional:
            profissional.nome,
        });
      }
    );
  }
);