jest.setTimeout(30000);

const request = require("supertest");
const app = require("../src/server");
const db = require("../src/db/db");

const SLUG_TESTE =
  process.env.TEST_NEGOCIO_SLUG ||
  "teste-1";

function obterDataHoraBrasil() {
  const partes =
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());

  const obterParte = (tipo) =>
    partes.find(
      (parte) => parte.type === tipo
    )?.value;

  return {
    ano: Number(obterParte("year")),
    mes: Number(obterParte("month")),
    dia: Number(obterParte("day")),
    hora: Number(obterParte("hour")),
    minuto: Number(obterParte("minute")),
  };
}

function obterDataHoraFuturaBrasil(
  horasAdicionais
) {
  const agoraBrasil =
    obterDataHoraBrasil();

  /*
   * Criamos um timestamp nominal em UTC porque
   * o service também compara data e horário do
   * Brasil como valores nominais.
   */
  const timestampBase = Date.UTC(
    agoraBrasil.ano,
    agoraBrasil.mes - 1,
    agoraBrasil.dia,
    agoraBrasil.hora,
    agoraBrasil.minuto,
    0
  );

  const dataFutura = new Date(
    timestampBase +
      horasAdicionais *
        60 *
        60 *
        1000
  );

  return {
    data: dataFutura
      .toISOString()
      .slice(0, 10),

    horario: dataFutura
      .toISOString()
      .slice(11, 16),
  };
}

describe(
  "Fluxo cliente logado",
  () => {
    let clienteId;
    let token;

    let profissionalId;
    let servicoId;
    let negocioId;

    let configuracaoOriginal = null;
    let configuracaoCriadaNoTeste = false;

    const agendamentosCriados =
      new Set();

    const identificador =
      `${Date.now()}_${process.pid}`;

    const email =
      `cliente_${identificador}@teste.com`;

    const whatsapp =
      `6299${String(Date.now()).slice(-8)}`;

    async function definirAntecedenciaCancelamento(
      horas
    ) {
      await db.query(
        `
        INSERT INTO agenda_configuracoes (
          profissional_id,
          duracao_padrao,
          intervalo_minutos,
          antecedencia_agendamento,
          antecedencia_cancelamento
        )
        VALUES (
          $1,
          60,
          0,
          0,
          $2
        )

        ON CONFLICT (profissional_id)

        DO UPDATE SET
          antecedencia_cancelamento =
            EXCLUDED.antecedencia_cancelamento,
          updated_at = NOW()
        `,
        [
          profissionalId,
          horas,
        ]
      );
    }

    async function criarAgendamentoDireto({
      data,
      horario,
    }) {
      const resultado =
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
            horario,
            profissionalId,
            clienteId,
            servicoId,
            negocioId,
          ]
        );

      const agendamentoId =
        resultado.rows[0].id;

      agendamentosCriados.add(
        agendamentoId
      );

      return agendamentoId;
    }

    async function buscarStatusAgendamento(
      agendamentoId
    ) {
      const resultado =
        await db.query(
          `
          SELECT status
          FROM agendamentos
          WHERE id = $1
          LIMIT 1
          `,
          [agendamentoId]
        );

      return resultado.rows[0]?.status;
    }

    beforeAll(async () => {
      const cadastro =
        await request(app)
          .post("/cadastro")
          .send({
            nome:
              "Cliente Teste Cancelamento",

            email,
            senha: "123456",
            whatsapp,
            tipo: "cliente",
          });

      expect([
        200,
        201,
      ]).toContain(
        cadastro.statusCode
      );

      const login =
        await request(app)
          .post("/login")
          .send({
            email,
            senha: "123456",
          });

      expect(
        login.statusCode
      ).toBe(200);

      expect(
        login.body.token
      ).toBeTruthy();

      token =
        login.body.token;

      const clienteResultado =
        await db.query(
          `
          SELECT id
          FROM usuarios
          WHERE email = $1
          LIMIT 1
          `,
          [email]
        );

      expect(
        clienteResultado.rows[0]
      ).toBeTruthy();

      clienteId =
        clienteResultado.rows[0].id;

      const perfil =
        await request(app).get(
          `/perfil-negocio/${SLUG_TESTE}`
        );

      expect(
        perfil.statusCode
      ).toBe(200);

      expect(
        perfil.body.servicos.length
      ).toBeGreaterThan(0);

      expect(
        perfil.body.profissionais.length
      ).toBeGreaterThan(0);

      servicoId =
        perfil.body.servicos[0].id;

      profissionalId =
        perfil.body.profissionais[0].id;

      const negocioResultado =
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
        negocioResultado.rows[0]
      ).toBeTruthy();

      negocioId =
        negocioResultado.rows[0].id;

      const configuracaoResultado =
        await db.query(
          `
          SELECT
            antecedencia_cancelamento
          FROM agenda_configuracoes
          WHERE profissional_id = $1
          LIMIT 1
          `,
          [profissionalId]
        );

      configuracaoOriginal =
        configuracaoResultado.rows[0] ||
        null;

      configuracaoCriadaNoTeste =
        !configuracaoOriginal;
    });

    afterAll(async () => {
      const ids =
        Array.from(
          agendamentosCriados
        );

      if (ids.length > 0) {
        await db.query(
          `
          DELETE FROM notificacoes
          WHERE agendamento_id =
            ANY($1::int[])
          `,
          [ids]
        );

        await db.query(
          `
          DELETE FROM agendamentos
          WHERE id =
            ANY($1::int[])
          `,
          [ids]
        );
      }

      if (
        profissionalId &&
        configuracaoCriadaNoTeste
      ) {
        await db.query(
          `
          DELETE FROM agenda_configuracoes
          WHERE profissional_id = $1
          `,
          [profissionalId]
        );
      } else if (
        profissionalId &&
        configuracaoOriginal
      ) {
        await db.query(
          `
          UPDATE agenda_configuracoes
          SET
            antecedencia_cancelamento = $2,
            updated_at = NOW()
          WHERE profissional_id = $1
          `,
          [
            profissionalId,
            configuracaoOriginal
              .antecedencia_cancelamento,
          ]
        );
      }

      if (clienteId) {
        await db.query(
          `
          DELETE FROM notificacoes
          WHERE usuario_id = $1
          `,
          [clienteId]
        );

        await db.query(
          `
          DELETE FROM usuarios
          WHERE id = $1
            AND tipo = 'cliente'
          `,
          [clienteId]
        );
      }
    });

    test(
      "cliente cadastrado consegue listar seus agendamentos",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/meus-agendamentos"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(200);

        expect(
          resposta.body
        ).toHaveProperty(
          "agendamentos"
        );

        expect(
          Array.isArray(
            resposta.body.agendamentos
          )
        ).toBe(true);
      }
    );

    test(
      "permite cancelar quando não existe antecedência mínima",
      async () => {
        await definirAntecedenciaCancelamento(
          0
        );

        const dataHora =
          obterDataHoraFuturaBrasil(
            2
          );

        const agendamentoId =
          await criarAgendamentoDireto(
            dataHora
          );

        const resposta =
          await request(app)
            .patch(
              `/agendamentos/${agendamentoId}/cancelar`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(200);

        expect(
          resposta.body.mensagem
        ).toBe(
          "Agendamento cancelado com sucesso."
        );

        const status =
          await buscarStatusAgendamento(
            agendamentoId
          );

        expect(status).toBe(
          "cancelado"
        );
      }
    );

    test(
      "recusa cancelamento quando resta menos tempo que a antecedência configurada",
      async () => {
        await definirAntecedenciaCancelamento(
          24
        );

        /*
         * O atendimento acontecerá em duas horas,
         * mas a configuração exige 24 horas
         * de antecedência para cancelar.
         */
        const dataHora =
          obterDataHoraFuturaBrasil(
            2
          );

        const agendamentoId =
          await criarAgendamentoDireto(
            dataHora
          );

        const resposta =
          await request(app)
            .patch(
              `/agendamentos/${agendamentoId}/cancelar`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toContain(
          "O prazo para cancelamento encerrou."
        );

        expect(
          resposta.body.erro
        ).toContain(
          "24 horas de antecedência"
        );

        const status =
          await buscarStatusAgendamento(
            agendamentoId
          );

        expect(status).toBe(
          "agendado"
        );
      }
    );
  }
);