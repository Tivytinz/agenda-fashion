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

let cenarioTeste;


function resumirResposta(
  contexto,
  resposta
) {
  let corpo;

  try {
    corpo = JSON.stringify(
      resposta?.body ?? null
    );
  } catch {
    corpo = String(
      resposta?.text || ""
    );
  }

  return (
    `${contexto} respondeu ` +
    `${resposta?.statusCode}: ` +
    `${corpo}`
  );
}

function exigirStatus(
  resposta,
  statusEsperado,
  contexto
) {
  if (
    resposta.statusCode !==
    statusEsperado
  ) {
    throw new Error(
      resumirResposta(
        contexto,
        resposta
      )
    );
  }
}

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
        `/perfil-negocio/${encodeURIComponent(
          cenarioTeste.slug
        )}`
      );

  exigirStatus(
    perfil,
    200,
    "Perfil público"
  );

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
          cenarioTeste.slug,

        servicoId:
          servico.id,

        profissionalId:
          profissional.id,
      });
  exigirStatus(
    agenda,
    200,
    "Agenda pública"
  );

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
    const agendamentosCriados =
      new Set();

    const usuariosCriados =
      new Set();

    const clientsCriados =
      new Set();

    beforeAll(
      async () => {
        cenarioTeste =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "teste-publico",
            }
          );
      },
      60000
    );

    afterAll(
      async () => {
        try {
          const agendamentoIds =
            Array.from(
              agendamentosCriados
            );

          if (
            agendamentoIds.length > 0
          ) {
            await db.query(
              `
                DELETE FROM agendamentos

                WHERE id =
                  ANY($1::BIGINT[])
              `,
              [
                agendamentoIds,
              ]
            );
          }

          const clientIds =
            Array.from(
              clientsCriados
            );

          if (
            clientIds.length > 0
          ) {
            await db.query(
              `
                DELETE FROM clientes

                WHERE id =
                  ANY($1::BIGINT[])
              `,
              [
                clientIds,
              ]
            );
          }

          const usuarioIds =
            Array.from(
              usuariosCriados
            );

          if (
            usuarioIds.length > 0
          ) {
            await db.query(
              `
                DELETE FROM usuarios

                WHERE id =
                  ANY($1::BIGINT[])

                  AND NOT EXISTS (
                    SELECT 1

                    FROM usuarios_negocios un

                    WHERE un.usuario_id =
                      usuarios.id
                  )
              `,
              [
                usuarioIds,
              ]
            );
          }

          await removerCenarioAgendamento(
            db,
            cenarioTeste
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
      "não oferece horários antes da confirmação explícita da agenda",
      async () => {
        const servico =
          cenarioTeste.servico;

        const profissional =
          cenarioTeste.profissional;

        await db.query(
          `
            UPDATE agenda_configuracoes
            SET configurado_em = NULL
            WHERE profissional_id = $1
          `,
          [
            profissional.id,
          ]
        );

        try {
          const agenda =
            await request(app)
              .get(
                "/agenda-publica"
              )
              .query({
                slug:
                  cenarioTeste.slug,

                servicoId:
                  servico.id,

                profissionalId:
                  profissional.id,
              });

          exigirStatus(
            agenda,
            200,
            "Agenda pública sem confirmação"
          );

          expect(
            Array.isArray(
              agenda.body.disponibilidade
            )
          ).toBe(true);

          expect(
            agenda.body.disponibilidade
              .every(
                (dia) =>
                  Array.isArray(
                    dia.horarios
                  ) &&
                  dia.horarios.length === 0
              )
          ).toBe(true);

          const data =
            agenda.body.disponibilidade[0]
              ?.data;

          expect(data).toBeTruthy();

          const tentativa =
            await request(app)
              .post(
                "/agendamentos"
              )
              .send({
                slug:
                  cenarioTeste.slug,

                servico_id:
                  servico.id,

                profissional_id:
                  profissional.id,

                data,
                horario:
                  "08:00",

                cliente_nome:
                  "Visitante Sem Agenda",

                cliente_whatsapp:
                  gerarWhatsappValido(),
              });

          expect(
            tentativa.statusCode
          ).toBe(409);

          expect(
            tentativa.body.erro
          ).toMatch(
            /horário não está mais disponível/i
          );
        } finally {
          await db.query(
            `
              UPDATE agenda_configuracoes
              SET configurado_em = NOW()
              WHERE profissional_id = $1
            `,
            [
              profissional.id,
            ]
          );
        }
      }
    );

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
                cenarioTeste.slug,

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

        const agendamentoId =
          Number(
            resposta.body
              .agendamento
              .id
          );

        const clientId =
          Number(
            resposta.body
              .agendamento
              .client_id
          );

        expect(clientId)
          .toBeGreaterThan(0);

        agendamentosCriados.add(
          agendamentoId
        );

        clientsCriados.add(
          clientId
        );

        const identidade =
          await db.query(
            `
              SELECT
                c.id,
                c.usuario_id,
                c.nome,
                c.whatsapp_normalizado
              FROM agendamentos a
              INNER JOIN clientes c
                ON c.id = a.client_id
              WHERE a.id = $1
            `,
            [
              agendamentoId,
            ]
          );

        expect(
          identidade.rows[0]
        ).toMatchObject({
          id:
            clientId,
          usuario_id:
            null,
          nome:
            "Visitante Teste",
        });
      }
    );

    test(
      "conta autenticada agenda usando a sessão HttpOnly",
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

        usuariosCriados.add(
          Number(
            cadastro.body
              .usuario
              .id
          )
        );

        expect(
          cadastro.body
        ).not.toHaveProperty(
          "token"
        );

        const cookieSessao =
          cadastro.headers[
            "set-cookie"
          ]?.[0]?.split(";", 1)[0];

        expect(
          cookieSessao
        ).toMatch(
          /^af_session=/i
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
              "Cookie",
              cookieSessao
            )
            .send({
              slug:
                cenarioTeste.slug,

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

        agendamentosCriados.add(
          Number(
            agendamentoId
          )
        );

        const clientId =
          Number(
            resposta.body
              .agendamento
              .client_id
          );

        expect(clientId)
          .toBeGreaterThan(0);

        clientsCriados.add(
          clientId
        );

        const identidade =
          await db.query(
            `
              SELECT
                c.id,
                c.usuario_id,
                c.nome,
                c.whatsapp_normalizado
              FROM agendamentos a
              INNER JOIN clientes c
                ON c.id = a.client_id
              WHERE a.id = $1
            `,
            [
              agendamentoId,
            ]
          );

        expect(
          Number(
            identidade.rows[0]
              ?.usuario_id
          )
        ).toBe(
          Number(
            cadastro.body
              .usuario.id
          )
        );

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
              "Cookie",
              cookieSessao
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