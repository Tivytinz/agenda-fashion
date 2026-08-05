jest.setTimeout(90000);

/*
 * Impede chamadas reais para WhatsApp durante
 * o teste de concorrência.
 */
jest.mock(
  "../src/services/notificationService",
  () => ({
    novoAgendamento:
      jest.fn().mockResolvedValue(null),

    agendamentoCancelado:
      jest.fn().mockResolvedValue(null),
  })
);

/*
 * Este teste valida exclusivamente a disputa pelo
 * mesmo horário. O limite comercial do plano possui
 * testes próprios e não deve impedir as duas
 * requisições de chegarem à regra de concorrência.
 */
jest.mock(
  "../src/services/planoService",
  () => {
    const planoServiceReal =
      jest.requireActual(
        "../src/services/planoService"
      );

    return {
      ...planoServiceReal,

      verificarCapacidadePlano:
        jest.fn().mockResolvedValue({
          ilimitado: true,
          status: "ilimitado",
        }),
    };
  }
);

const request = require("supertest");

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

function normalizarId(valor) {
  const id = Number(valor);

  return (
    Number.isInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function normalizarHorario(valor) {
  if (
    typeof valor === "string"
  ) {
    return valor
      .trim()
      .slice(0, 5);
  }

  if (
    valor &&
    typeof valor === "object"
  ) {
    return String(
      valor.hora ||
      valor.horario ||
      ""
    )
      .trim()
      .slice(0, 5);
  }

  return "";
}

function gerarWhatsappsTeste() {
  const sufixo =
    String(Date.now())
      .slice(-8)
      .padStart(8, "0");

  return [
    `629${sufixo}`,
    `639${sufixo}`,
  ];
}

/*
 * Confirma que o cenário isolado está acessível
 * pelas mesmas rotas públicas usadas pelo cliente:
 *
 * - perfil público acessível;
 * - serviço presente no perfil;
 * - profissional presente no perfil;
 * - pelo menos um horário disponível.
 */
async function buscarCenarioDisponivel() {
  const candidatos =
    [
      {
        slug:
          cenarioTeste.slug,
        servicoId:
          cenarioTeste.servico.id,
        profissionalId:
          cenarioTeste.profissional.id,
      },
    ];

  const erros = [];

  if (
    candidatos.length === 0
  ) {
    throw new Error(
      "Nenhum negócio com serviço e profissional foi encontrado para o teste."
    );
  }

  for (
    const candidato
    of candidatos
  ) {
    const perfil =
      await request(app)
        .get(
          `/perfil-negocio/${
            encodeURIComponent(
              candidato.slug
            )
          }`
        );

    if (
      perfil.statusCode !== 200
    ) {
      erros.push(
        resumirResposta(
          "Perfil público",
          perfil
        )
      );

      continue;
    }

    const servicos =
      Array.isArray(
        perfil.body?.servicos
      )
        ? perfil.body.servicos
        : [];

    const profissionais =
      Array.isArray(
        perfil.body?.profissionais
      )
        ? perfil.body.profissionais
        : [];

    const servico =
      servicos.find(
        (item) =>
          Number(item?.id) ===
          candidato.servicoId
      );

    const profissional =
      profissionais.find(
        (item) =>
          Number(item?.id) ===
          candidato.profissionalId
      );

    if (
      !servico ||
      !profissional
    ) {
      erros.push(
        "O perfil público não devolveu o serviço ou o profissional do cenário isolado."
      );

      continue;
    }

    const agenda =
      await request(app)
        .get(
          "/agenda-publica"
        )
        .query({
          slug:
            candidato.slug,

          servicoId:
            servico.id,

          profissionalId:
            profissional.id,
        });

    if (
      agenda.statusCode !== 200
    ) {
      erros.push(
        resumirResposta(
          "Agenda pública",
          agenda
        )
      );

      continue;
    }

    const disponibilidade =
      Array.isArray(
        agenda.body
          ?.disponibilidade
      )
        ? agenda.body
            .disponibilidade
        : [];

    const diaDisponivel =
      disponibilidade.find(
        (dia) =>
          dia?.data &&
          Array.isArray(
            dia?.horarios
          ) &&
          dia.horarios.some(
            (item) =>
              normalizarHorario(
                item
              )
          )
      );

    if (!diaDisponivel) {
      erros.push(
        "A agenda pública respondeu 200, mas não devolveu nenhum dia com horário disponível."
      );

      continue;
    }

    const horario =
      diaDisponivel.horarios
        .map(
          normalizarHorario
        )
        .find(Boolean);

    if (!horario) {
      erros.push(
        "A agenda pública devolveu horários, mas nenhum deles pôde ser normalizado."
      );

      continue;
    }

    return {
      slug:
        candidato.slug,

      negocioId:
        normalizarId(
          perfil.body
            ?.negocio?.id
        ),

      servico: {
        ...servico,

        id:
          normalizarId(
            servico.id
          ),
      },

      profissional: {
        ...profissional,

        id:
          normalizarId(
            profissional.id
          ),
      },

      data:
        String(
          diaDisponivel.data
        ).slice(0, 10),

      horario,
    };
  }

  throw new Error(
    [
      "Nenhum horário disponível foi encontrado para executar o teste de concorrência.",
      ...erros,
    ].join("\n")
  );
}

async function buscarAgendamentosDoHorario({
  profissionalId,
  data,
  horario,
  criadoDepoisDe,
}) {
  const resultado =
    await db.query(
      `
        SELECT
          id,
          status,
          cliente_id,
          cliente_nome,
          cliente_whatsapp,
          created_at

        FROM agendamentos

        WHERE profissional_id = $1
          AND data = $2
          AND TO_CHAR(
            horario::TIME,
            'HH24:MI'
          ) = $3
          AND created_at >= $4

        ORDER BY id
      `,
      [
        profissionalId,
        data,
        horario,
        criadoDepoisDe,
      ]
    );

  return resultado.rows;
}

describe(
  "Concorrência no agendamento público",
  () => {
    const agendamentosCriados =
      new Set();

    const whatsappsCriados =
      new Set();

    beforeAll(
      async () => {
        cenarioTeste =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "teste-concorrencia",
            }
          );
      },
      60000
    );

    afterAll(
      async () => {
        try {
          const ids =
            Array.from(
              agendamentosCriados
            );

          if (
            ids.length > 0
          ) {
            await db.query(
              `
                DELETE FROM notificacoes

                WHERE agendamento_id =
                  ANY($1::INT[])
              `,
              [
                ids,
              ]
            );

            await db.query(
              `
                DELETE FROM agendamentos

                WHERE id =
                  ANY($1::INT[])
              `,
              [
                ids,
              ]
            );
          }

          /*
           * Compatibilidade com versões antigas,
           * nas quais visitantes eram transformados
           * em usuários automaticamente.
           *
           * Na arquitetura nova, esta consulta
           * apenas não encontrará registros.
           */
          const whatsapps =
            Array.from(
              whatsappsCriados
            );

          if (
            whatsapps.length > 0
          ) {
            await db.query(
              `
                DELETE FROM usuarios u

                WHERE u.whatsapp =
                  ANY($1::TEXT[])

                  AND NOT EXISTS (
                    SELECT 1

                    FROM agendamentos a

                    WHERE a.cliente_id =
                      u.id
                  )

                  AND NOT EXISTS (
                    SELECT 1

                    FROM usuarios_negocios un

                    WHERE un.usuario_id =
                      u.id
                  )
              `,
              [
                whatsapps,
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
      "permite apenas um agendamento quando duas clientes tentam reservar simultaneamente",
      async () => {
        const cenario =
          await buscarCenarioDisponivel();

        expect(
          cenario.negocioId
        ).toBeGreaterThan(0);

        expect(
          cenario.servico.id
        ).toBeGreaterThan(0);

        expect(
          cenario.profissional.id
        ).toBeGreaterThan(0);

        expect(
          cenario.data
        ).toMatch(
          /^\d{4}-\d{2}-\d{2}$/
        );

        expect(
          cenario.horario
        ).toMatch(
          /^\d{2}:\d{2}$/
        );

        /*
         * Confirma diretamente no banco que não existe
         * agendamento ativo antes da concorrência.
         */
        const antes =
          await db.query(
            `
              SELECT
                COUNT(*)::INT
                  AS total

              FROM agendamentos

              WHERE profissional_id = $1
                AND data = $2
                AND TO_CHAR(
                  horario::TIME,
                  'HH24:MI'
                ) = $3
                AND status IN (
                  'agendado',
                  'confirmado'
                )
            `,
            [
              cenario.profissional.id,
              cenario.data,
              cenario.horario,
            ]
          );

        expect(
          Number(
            antes.rows[0]?.total
          )
        ).toBe(0);

        const [
          whatsappClienteA,
          whatsappClienteB,
        ] =
          gerarWhatsappsTeste();

        whatsappsCriados.add(
          whatsappClienteA
        );

        whatsappsCriados.add(
          whatsappClienteB
        );

        const inicioConcorrencia =
          new Date(
            Date.now() - 1000
          );

        const payloadBase = {
          slug:
            cenario.slug,

          servico_id:
            cenario.servico.id,

          profissional_id:
            cenario.profissional.id,

          data:
            cenario.data,

          horario:
            cenario.horario,
        };

        /*
         * As duas requisições são iniciadas sem aguardar
         * a conclusão uma da outra.
         */
        const [
          respostaA,
          respostaB,
        ] =
          await Promise.all([
            request(app)
              .post(
                "/agendamentos"
              )
              .send({
                ...payloadBase,

                cliente_nome:
                  "Cliente Concorrência A",

                cliente_whatsapp:
                  whatsappClienteA,
              }),

            request(app)
              .post(
                "/agendamentos"
              )
              .send({
                ...payloadBase,

                cliente_nome:
                  "Cliente Concorrência B",

                cliente_whatsapp:
                  whatsappClienteB,
              }),
          ]);

        const respostas = [
          respostaA,
          respostaB,
        ];

        /*
         * Uma requisição deve criar o agendamento.
         * A outra deve receber conflito de horário.
         */
        expect(
          respostas
            .map(
              (resposta) =>
                resposta.statusCode
            )
            .sort(
              (a, b) =>
                a - b
            )
        ).toEqual([
          201,
          409,
        ]);

        const respostaSucesso =
          respostas.find(
            (resposta) =>
              resposta.statusCode ===
              201
          );

        const respostaConflito =
          respostas.find(
            (resposta) =>
              resposta.statusCode ===
              409
          );

        expect(
          respostaSucesso
        ).toBeTruthy();

        expect(
          respostaSucesso.body
        ).toHaveProperty(
          "agendamento"
        );

        expect(
          normalizarId(
            respostaSucesso.body
              ?.agendamento?.id
          )
        ).toBeGreaterThan(0);

        expect(
          respostaConflito
        ).toBeTruthy();

        expect(
          respostaConflito.body
            ?.erro
        ).toEqual(
          expect.any(String)
        );

        expect(
          respostaConflito.body
            .erro
            .toLocaleLowerCase(
              "pt-BR"
            )
        ).toMatch(
          /horário|disponível|reservado/
        );

        /*
         * Registra todos os IDs criados durante a
         * janela do teste para limpeza posterior,
         * inclusive caso alguma resposta falhe
         * depois do COMMIT.
         */
        const registrosCriados =
          await buscarAgendamentosDoHorario({
            profissionalId:
              cenario.profissional.id,

            data:
              cenario.data,

            horario:
              cenario.horario,

            criadoDepoisDe:
              inicioConcorrencia,
          });

        registrosCriados
          .forEach(
            (registro) => {
              const id =
                normalizarId(
                  registro.id
                );

              if (id) {
                agendamentosCriados.add(
                  id
                );
              }
            }
          );

        expect(
          registrosCriados
        ).toHaveLength(1);

        expect(
          registrosCriados[0]
            .status
        ).toMatch(
          /agendado|confirmado/
        );

        /*
         * Confirma a regra principal diretamente
         * no banco: existe somente um horário ativo.
         */
        const depois =
          await db.query(
            `
              SELECT
                COUNT(*)::INT
                  AS total

              FROM agendamentos

              WHERE profissional_id = $1
                AND data = $2
                AND TO_CHAR(
                  horario::TIME,
                  'HH24:MI'
                ) = $3
                AND status IN (
                  'agendado',
                  'confirmado'
                )
            `,
            [
              cenario.profissional.id,
              cenario.data,
              cenario.horario,
            ]
          );

        expect(
          Number(
            depois.rows[0]?.total
          )
        ).toBe(1);
      },
      60000
    );
  }
);
