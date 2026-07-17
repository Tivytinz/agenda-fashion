jest.setTimeout(60000);

/*
 * Impede que testes de integração realizem
 * chamadas reais para serviços externos.
 *
 * Esta suíte valida API, regras de cancelamento
 * e persistência no PostgreSQL.
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

const request = require("supertest");

const app = require(
  "../src/server"
);

const db = require(
  "../src/db/db"
);

/*
 * Retorna a data e a hora atuais considerando
 * o fuso de São Paulo.
 */
function obterDataHoraBrasil() {
  const partes =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone:
          "America/Sao_Paulo",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date()
    );

  const obterParte =
    (tipo) =>
      partes.find(
        (parte) =>
          parte.type === tipo
      )?.value;

  return {
    ano:
      Number(
        obterParte("year")
      ),

    mes:
      Number(
        obterParte("month")
      ),

    dia:
      Number(
        obterParte("day")
      ),

    hora:
      Number(
        obterParte("hour")
      ),

    minuto:
      Number(
        obterParte("minute")
      ),
  };
}

/*
 * Gera uma data futura usando os valores
 * nominais do horário brasileiro.
 *
 * O timestamp UTC aqui é usado somente para
 * realizar corretamente a soma das horas.
 */
function obterDataHoraFuturaBrasil(
  horasAdicionais
) {
  const agoraBrasil =
    obterDataHoraBrasil();

  const timestampBase =
    Date.UTC(
      agoraBrasil.ano,
      agoraBrasil.mes - 1,
      agoraBrasil.dia,
      agoraBrasil.hora,
      agoraBrasil.minuto,
      0
    );

  const dataFutura =
    new Date(
      timestampBase +
        horasAdicionais *
          60 *
          60 *
          1000
    );

  return {
    data:
      dataFutura
        .toISOString()
        .slice(0, 10),

    horario:
      dataFutura
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

    let configuracaoOriginal =
      null;

    let configuracaoCriadaNoTeste =
      false;

    const agendamentosCriados =
      new Set();

    const identificador =
      `${Date.now()}_${process.pid}`;

    const email =
      `cliente_${identificador}@teste.com`;

    /*
     * 62 + 9 + últimos oito dígitos:
     * total de 11 dígitos.
     */
    const whatsapp =
      `629${String(
        Date.now()
      ).slice(-8)}`;

    async function definirAntecedenciaCancelamento(
      horas
    ) {
      await db.query(
        `
          INSERT INTO
            agenda_configuracoes (
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

          ON CONFLICT (
            profissional_id
          )

          DO UPDATE SET
            antecedencia_cancelamento =
              EXCLUDED.antecedencia_cancelamento,

            updated_at =
              NOW()
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
            INSERT INTO
              agendamentos (
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

            RETURNING
              id
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
        Number(
          resultado.rows[0].id
        );

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
            SELECT
              status

            FROM agendamentos

            WHERE id = $1

            LIMIT 1
          `,
          [
            agendamentoId,
          ]
        );

      return (
        resultado.rows[0]
          ?.status ||
        null
      );
    }

    /*
     * Procura IDs que realmente existem no banco.
     *
     * Primeiro reaproveita uma combinação que já
     * apareceu em algum agendamento válido.
     */
    async function buscarDadosBase() {
      let resultado =
        await db.query(
          `
            SELECT
              COALESCE(
                a.negocio_id,
                s.negocio_id
              ) AS negocio_id,

              a.servico_id,
              a.profissional_id

            FROM agendamentos a

            INNER JOIN
              servicos_negocio s
              ON s.id =
                a.servico_id

            INNER JOIN
              negocios n
              ON n.id =
                COALESCE(
                  a.negocio_id,
                  s.negocio_id
                )

            INNER JOIN
              usuarios u
              ON u.id =
                a.profissional_id

            WHERE
              a.servico_id
                IS NOT NULL

              AND a.profissional_id
                IS NOT NULL

              AND COALESCE(
                a.negocio_id,
                s.negocio_id
              ) IS NOT NULL

              AND COALESCE(
                u.ativo,
                TRUE
              ) = TRUE

            ORDER BY
              a.id DESC

            LIMIT 1
          `
        );

      if (
        resultado.rows[0]
      ) {
        return resultado.rows[0];
      }

      /*
       * Banco sem agendamentos:
       * procura qualquer negócio com serviço
       * e usuário vinculado.
       */
      resultado =
        await db.query(
          `
            SELECT
              n.id
                AS negocio_id,

              s.id
                AS servico_id,

              un.usuario_id
                AS profissional_id

            FROM negocios n

            INNER JOIN
              servicos_negocio s
              ON s.negocio_id =
                n.id

            INNER JOIN
              usuarios_negocios un
              ON un.negocio_id =
                n.id

              AND un.papel IN (
                'dono',
                'profissional'
              )

            INNER JOIN
              usuarios u
              ON u.id =
                un.usuario_id

            WHERE
              COALESCE(
                s.ativo,
                TRUE
              ) = TRUE

              AND COALESCE(
                u.ativo,
                TRUE
              ) = TRUE

            ORDER BY
              CASE
                WHEN un.papel =
                  'profissional'
                THEN 0
                ELSE 1
              END,

              n.id ASC,
              s.id ASC,
              un.usuario_id ASC

            LIMIT 1
          `
        );

      return (
        resultado.rows[0] ||
        null
      );
    }

    beforeAll(
      async () => {
        const cadastro =
          await request(app)
            .post(
              "/cadastro"
            )
            .send({
              nome:
                "Cliente Teste Cancelamento",

              email,

              senha:
                "123456",

              whatsapp,
            });

        expect([
          200,
          201,
        ]).toContain(
          cadastro.statusCode
        );

        expect(
          cadastro.body.token
        ).toBeTruthy();

        expect(
          cadastro.body
            .usuario?.id
        ).toBeTruthy();

        /*
         * O cadastro já retorna uma sessão.
         * Não é necessário chamar /login.
         */
        token =
          cadastro.body.token;

        clienteId =
          Number(
            cadastro.body
              .usuario.id
          );

        expect(
          clienteId
        ).toBeGreaterThan(0);

        const dadosBase =
          await buscarDadosBase();

        expect(
          dadosBase
        ).toBeTruthy();

        negocioId =
          Number(
            dadosBase.negocio_id
          );

        servicoId =
          Number(
            dadosBase.servico_id
          );

        profissionalId =
          Number(
            dadosBase.profissional_id
          );

        expect(
          negocioId
        ).toBeGreaterThan(0);

        expect(
          servicoId
        ).toBeGreaterThan(0);

        expect(
          profissionalId
        ).toBeGreaterThan(0);

        const configuracaoResultado =
          await db.query(
            `
              SELECT
                antecedencia_cancelamento

              FROM agenda_configuracoes

              WHERE
                profissional_id = $1

              LIMIT 1
            `,
            [
              profissionalId,
            ]
          );

        configuracaoOriginal =
          configuracaoResultado
            .rows[0] ||
          null;

        configuracaoCriadaNoTeste =
          !configuracaoOriginal;
      },
      60000
    );

    beforeEach(
      () => {
        jest.clearAllMocks();
      }
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
                DELETE FROM
                  notificacoes

                WHERE
                  agendamento_id =
                    ANY($1::INT[])
              `,
              [
                ids,
              ]
            );

            await db.query(
              `
                DELETE FROM
                  agendamentos

                WHERE
                  id =
                    ANY($1::INT[])
              `,
              [
                ids,
              ]
            );
          }

          if (
            profissionalId &&
            configuracaoCriadaNoTeste
          ) {
            await db.query(
              `
                DELETE FROM
                  agenda_configuracoes

                WHERE
                  profissional_id = $1
              `,
              [
                profissionalId,
              ]
            );
          } else if (
            profissionalId &&
            configuracaoOriginal
          ) {
            await db.query(
              `
                UPDATE
                  agenda_configuracoes

                SET
                  antecedencia_cancelamento =
                    $2,

                  updated_at =
                    NOW()

                WHERE
                  profissional_id = $1
              `,
              [
                profissionalId,

                configuracaoOriginal
                  .antecedencia_cancelamento,
              ]
            );
          }

          if (
            clienteId
          ) {
            /*
             * Remove qualquer notificação ligada
             * ao usuário criado pelo teste.
             */
            await db.query(
              `
                DELETE FROM
                  notificacoes

                WHERE
                  usuario_id = $1
              `,
              [
                clienteId,
              ]
            );

            /*
             * Não existe mais usuarios.tipo.
             */
            await db.query(
              `
                DELETE FROM
                  usuarios

                WHERE
                  id = $1
              `,
              [
                clienteId,
              ]
            );
          }
        } finally {
          /*
           * Fecha o pool para o Jest não permanecer
           * esperando conexões abertas.
           */
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
            resposta.body
              .agendamentos
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

        expect(
          status
        ).toBe(
          "cancelado"
        );

        /*
         * Não verificamos chamadas de WhatsApp.
         *
         * O objetivo desta suíte é validar:
         * - autenticação;
         * - regra de antecedência;
         * - atualização no banco.
         */
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

        expect(
          status
        ).toBe(
          "agendado"
        );
      }
    );
  }
);