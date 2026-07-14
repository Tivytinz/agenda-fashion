jest.setTimeout(30000);

jest.mock(
  "../src/services/notificationService",
  () => ({
    novoAgendamento: jest
      .fn()
      .mockResolvedValue({
        sucesso: true,
      }),
  })
);

const request = require("supertest");
const app = require("../src/server");
const db = require("../src/db/db");

const SLUG_TESTE =
  process.env.TEST_NEGOCIO_SLUG ||
  "teste-1";

function normalizarHorario(horario) {
  return String(horario || "").slice(0, 5);
}

function horarioParaMinutos(horario) {
  const horarioNormalizado =
    normalizarHorario(horario);

  const [hora, minuto] =
    horarioNormalizado
      .split(":")
      .map(Number);

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return hora * 60 + minuto;
}

function minutosParaHorario(totalMinutos) {
  const hora = Math.floor(
    totalMinutos / 60
  );

  const minuto =
    totalMinutos % 60;

  return `${String(hora).padStart(
    2,
    "0"
  )}:${String(minuto).padStart(
    2,
    "0"
  )}`;
}

function obterDataBrasil() {
  const partes =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone:
          "America/Sao_Paulo",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const obterParte = (tipo) =>
    partes.find(
      (parte) =>
        parte.type === tipo
    )?.value;

  return `${obterParte(
    "year"
  )}-${obterParte(
    "month"
  )}-${obterParte(
    "day"
  )}`;
}

function obterOntemBrasil() {
  const hoje = new Date(
    `${obterDataBrasil()}T12:00:00Z`
  );

  hoje.setUTCDate(
    hoje.getUTCDate() - 1
  );

  return hoje
    .toISOString()
    .slice(0, 10);
}

function obterDiaSemana(data) {
  return new Date(
    `${data}T12:00:00Z`
  ).getUTCDay();
}

describe(
  "Fluxo de agendamento público",
  () => {
    let profissional;
    let servico;
    let negocioId;

    const agendamentosCriados =
      new Set();

    const bloqueiosCriados =
      new Set();

    const whatsappTeste =
      `6299${String(
        Date.now()
      ).slice(-8)}`;

    async function buscarPerfil() {
      const resposta =
        await request(app).get(
          `/perfil-negocio/${SLUG_TESTE}`
        );

      expect(
        resposta.statusCode
      ).toBe(200);

      expect(
        resposta.body.servicos
          .length
      ).toBeGreaterThan(0);

      expect(
        resposta.body.profissionais
          .length
      ).toBeGreaterThan(0);

      return resposta.body;
    }

    async function buscarAgenda() {
      const resposta =
        await request(app)
          .get("/agenda-publica")
          .query({
            slug: SLUG_TESTE,

            servicoId:
              servico.id,

            profissionalId:
              profissional.id,
          });

      expect(
        resposta.statusCode
      ).toBe(200);

      expect(
        Array.isArray(
          resposta.body
            .disponibilidade
        )
      ).toBe(true);

      return resposta.body
        .disponibilidade;
    }

    async function buscarPrimeiroHorarioDisponivel() {
      const disponibilidade =
        await buscarAgenda();

      const diaComHorario =
        disponibilidade.find(
          (dia) =>
            Array.isArray(
              dia.horarios
            ) &&
            dia.horarios.length >
              0
        );

      expect(
        diaComHorario
      ).toBeTruthy();

      return {
        data:
          diaComHorario.data,

        horario:
          diaComHorario
            .horarios[0],
      };
    }

    function montarPayload({
      data,
      horario,
    }) {
      return {
        slug: SLUG_TESTE,

        servico_id:
          servico.id,

        profissional_id:
          profissional.id,

        data,
        horario,

        cliente_nome:
          "Cliente Teste Automatizado",

        cliente_whatsapp:
          whatsappTeste,
      };
    }

    function registrarAgendamento(
      resposta
    ) {
      const agendamento =
        resposta.body
          ?.agendamento;

      if (agendamento?.id) {
        agendamentosCriados.add(
          agendamento.id
        );
      }
    }

    async function removerAgendamento(
      agendamentoId
    ) {
      await db.query(
        `
        DELETE FROM notificacoes
        WHERE agendamento_id = $1
        `,
        [agendamentoId]
      );

      await db.query(
        `
        DELETE FROM agendamentos
        WHERE id = $1
        `,
        [agendamentoId]
      );

      agendamentosCriados.delete(
        agendamentoId
      );
    }

    beforeAll(async () => {
      const perfil =
        await buscarPerfil();

      servico =
        perfil.servicos[0];

      profissional =
        perfil.profissionais[0];

      const negocio =
        await db.query(
          `
          SELECT id
          FROM negocios
          WHERE slug = $1
          LIMIT 1
          `,
          [SLUG_TESTE]
        );

      expect(
        negocio.rows[0]
      ).toBeTruthy();

      negocioId =
        negocio.rows[0].id;
    });

    afterAll(async () => {
      for (
        const bloqueioId of
        bloqueiosCriados
      ) {
        await db.query(
          `
          DELETE FROM bloqueios_horarios
          WHERE id = $1
          `,
          [bloqueioId]
        );
      }

      for (
        const agendamentoId of
        agendamentosCriados
      ) {
        await db.query(
          `
          DELETE FROM notificacoes
          WHERE agendamento_id = $1
          `,
          [agendamentoId]
        );

        await db.query(
          `
          DELETE FROM agendamentos
          WHERE id = $1
          `,
          [agendamentoId]
        );
      }

      await db.query(
        `
        DELETE FROM usuarios
        WHERE tipo = 'cliente'
          AND whatsapp = $1
          AND NOT EXISTS (
            SELECT 1
            FROM agendamentos
            WHERE cliente_id =
              usuarios.id
          )
        `,
        [whatsappTeste]
      );
    });

    test(
      "visitante consegue consultar a agenda e criar um agendamento válido",
      async () => {
        const {
          data,
          horario,
        } =
          await buscarPrimeiroHorarioDisponivel();

        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send(
              montarPayload({
                data,
                horario,
              })
            );

        expect(
          resposta.statusCode
        ).toBe(201);

        expect(
          resposta.body.mensagem
        ).toBe(
          "Agendamento criado com sucesso."
        );

        expect(
          resposta.body
        ).toHaveProperty(
          "agendamento"
        );

        registrarAgendamento(
          resposta
        );
      }
    );

    test(
      "rejeita dois agendamentos no mesmo horário",
      async () => {
        const {
          data,
          horario,
        } =
          await buscarPrimeiroHorarioDisponivel();

        const payload =
          montarPayload({
            data,
            horario,
          });

        const primeiraResposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send(payload);

        expect(
          primeiraResposta.statusCode
        ).toBe(201);

        registrarAgendamento(
          primeiraResposta
        );

        const segundaResposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send(payload);

        expect(
          segundaResposta.statusCode
        ).toBe(409);

        expect(
          segundaResposta.body.erro
        ).toBe(
          "Esse horário não está mais disponível. Escolha outro horário."
        );
      }
    );

    test(
      "rejeita horário enviado manualmente fora do expediente",
      async () => {
        const disponibilidade =
          await buscarAgenda();

        const data =
          disponibilidade[0]
            .data;

        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send(
              montarPayload({
                data,
                horario: "03:00",
              })
            );

        expect(
          resposta.statusCode
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toBe(
          "Esse horário não está mais disponível. Escolha outro horário."
        );
      }
    );

    test(
      "rejeita agendamento em uma data passada",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/agendamentos"
            )
            .send(
              montarPayload({
                data:
                  obterOntemBrasil(),

                horario: "10:00",
              })
            );

        expect(
          resposta.statusCode
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toBe(
          "Esse horário não está mais disponível. Escolha outro horário."
        );
      }
    );

    test(
      "rejeita um horário bloqueado pelo profissional",
      async () => {
        const {
          data,
          horario,
        } =
          await buscarPrimeiroHorarioDisponivel();

        const bloqueio =
          await db.query(
            `
            INSERT INTO bloqueios_horarios (
              profissional_id,
              data_bloqueio,
              hora_bloqueio
            )
            VALUES ($1, $2, $3)
            RETURNING id
            `,
            [
              profissional.id,
              data,
              horario,
            ]
          );

        const bloqueioId =
          bloqueio.rows[0].id;

        bloqueiosCriados.add(
          bloqueioId
        );

        try {
          const resposta =
            await request(app)
              .post(
                "/agendamentos"
              )
              .send(
                montarPayload({
                  data,
                  horario,
                })
              );

          expect(
            resposta.statusCode
          ).toBe(409);

          expect(
            resposta.body.erro
          ).toBe(
            "Esse horário não está mais disponível. Escolha outro horário."
          );
        } finally {
          await db.query(
            `
            DELETE FROM bloqueios_horarios
            WHERE id = $1
            `,
            [bloqueioId]
          );

          bloqueiosCriados.delete(
            bloqueioId
          );
        }
      }
    );

    test(
      "rejeita horário que atravessa o intervalo de almoço",
      async () => {
        const {
          data,
          horario,
        } =
          await buscarPrimeiroHorarioDisponivel();

        const diaSemana =
          obterDiaSemana(data);

        const horarioOriginal =
          await db.query(
            `
            SELECT
              trabalha,

              TO_CHAR(
                hora_inicio,
                'HH24:MI'
              ) AS hora_inicio,

              TO_CHAR(
                hora_fim,
                'HH24:MI'
              ) AS hora_fim,

              TO_CHAR(
                intervalo_inicio,
                'HH24:MI'
              ) AS intervalo_inicio,

              TO_CHAR(
                intervalo_fim,
                'HH24:MI'
              ) AS intervalo_fim

            FROM agenda_horarios

            WHERE profissional_id = $1
              AND dia_semana = $2

            LIMIT 1
            `,
            [
              profissional.id,
              diaSemana,
            ]
          );

        const configuracaoAnterior =
          horarioOriginal.rows[0] ||
          null;

        const inicioAlmoco =
          normalizarHorario(
            horario
          );

        const fimAlmoco =
          minutosParaHorario(
            horarioParaMinutos(
              horario
            ) + 1
          );

        const horaInicio =
          configuracaoAnterior
            ?.hora_inicio ||
          "08:00";

        const horaFim =
          configuracaoAnterior
            ?.hora_fim ||
          "20:00";

        try {
          await db.query(
            `
            INSERT INTO agenda_horarios (
              profissional_id,
              dia_semana,
              trabalha,
              hora_inicio,
              hora_fim,
              intervalo_inicio,
              intervalo_fim
            )
            VALUES (
              $1,
              $2,
              TRUE,
              $3,
              $4,
              $5,
              $6
            )

            ON CONFLICT (
              profissional_id,
              dia_semana
            )

            DO UPDATE SET
              trabalha = TRUE,
              hora_inicio =
                EXCLUDED.hora_inicio,
              hora_fim =
                EXCLUDED.hora_fim,
              intervalo_inicio =
                EXCLUDED.intervalo_inicio,
              intervalo_fim =
                EXCLUDED.intervalo_fim,
              updated_at = NOW()
            `,
            [
              profissional.id,
              diaSemana,
              horaInicio,
              horaFim,
              inicioAlmoco,
              fimAlmoco,
            ]
          );

          const resposta =
            await request(app)
              .post(
                "/agendamentos"
              )
              .send(
                montarPayload({
                  data,
                  horario,
                })
              );

          expect(
            resposta.statusCode
          ).toBe(409);

          expect(
            resposta.body.erro
          ).toBe(
            "Esse horário não está mais disponível. Escolha outro horário."
          );
        } finally {
          if (
            configuracaoAnterior
          ) {
            await db.query(
              `
              UPDATE agenda_horarios

              SET
                trabalha = $3,
                hora_inicio = $4,
                hora_fim = $5,
                intervalo_inicio = $6,
                intervalo_fim = $7,
                updated_at = NOW()

              WHERE profissional_id = $1
                AND dia_semana = $2
              `,
              [
                profissional.id,
                diaSemana,

                configuracaoAnterior
                  .trabalha,

                configuracaoAnterior
                  .hora_inicio,

                configuracaoAnterior
                  .hora_fim,

                configuracaoAnterior
                  .intervalo_inicio,

                configuracaoAnterior
                  .intervalo_fim,
              ]
            );
          } else {
            await db.query(
              `
              DELETE FROM agenda_horarios
              WHERE profissional_id = $1
                AND dia_semana = $2
              `,
              [
                profissional.id,
                diaSemana,
              ]
            );
          }
        }
      }
    );

    test(
      "rejeita sobreposição parcial pela duração do serviço",
      async () => {
        const {
          data,
          horario,
        } =
          await buscarPrimeiroHorarioDisponivel();

        const duracaoServico =
          Math.max(
            Number(
              servico.duracao_minutos
            ) || 60,
            2
          );

        const inicioNovo =
          horarioParaMinutos(
            horario
          );

        const inicioExistente =
          inicioNovo +
          Math.max(
            1,
            Math.floor(
              duracaoServico / 2
            )
          );

        const horarioExistente =
          minutosParaHorario(
            inicioExistente
          );

        const cliente =
          await db.query(
            `
            SELECT id
            FROM usuarios
            WHERE tipo = 'cliente'
              AND whatsapp = $1
            LIMIT 1
            `,
            [whatsappTeste]
          );

        expect(
          cliente.rows[0]
        ).toBeTruthy();

        const agendamentoManual =
          await db.query(
            `
            INSERT INTO agendamentos (
              data,
              horario,
              profissional_id,
              cliente_id,
              servico_id,
              negocio_id,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              'agendado'
            )
            RETURNING id
            `,
            [
              data,
              horarioExistente,
              profissional.id,
              cliente.rows[0].id,
              servico.id,
              negocioId,
            ]
          );

        const agendamentoManualId =
          agendamentoManual
            .rows[0].id;

        agendamentosCriados.add(
          agendamentoManualId
        );

        try {
          const resposta =
            await request(app)
              .post(
                "/agendamentos"
              )
              .send(
                montarPayload({
                  data,
                  horario,
                })
              );

          expect(
            resposta.statusCode
          ).toBe(409);

          expect(
            resposta.body.erro
          ).toBe(
            "Esse horário não está mais disponível. Escolha outro horário."
          );
        } finally {
          await removerAgendamento(
            agendamentoManualId
          );
        }
      }
    );
  }
);