jest.setTimeout(60000);

const db = require(
  "../src/db/db"
);
const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);
const {
  obterDataHoraNoFuso,
} = require(
  "../src/utils/fusoHorario"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require(
  "./helpers/cenarioAgendamento"
);

function adicionarDias(
  data,
  quantidade
) {
  const base =
    new Date(
      `${data}T12:00:00Z`
    );

  base.setUTCDate(
    base.getUTCDate() +
      quantidade
  );

  return base
    .toISOString()
    .slice(0, 10);
}

describe(
  "CA-NFR-04 - instante UTC e fuso IANA",
  () => {
    let cenario;
    let negocioSecundarioId;
    let servicoSecundarioId;
    let agendamentoId;
    let clientId;

    beforeAll(
      async () => {
        cenario =
          await criarCenarioAgendamento(
            db,
            {
              prefixo:
                "nfr-timezone",
            }
          );

        await db.query(
          `
            UPDATE negocios
            SET fuso_horario =
              'America/Sao_Paulo'
            WHERE id = $1
          `,
          [cenario.negocioId]
        );

        const base =
          await db.query(
            `
              SELECT
                plano_id
              FROM negocios
              WHERE id = $1
            `,
            [cenario.negocioId]
          );

        const slug =
          `nfr-timezone-manaus-${process.pid}-${Date.now()}`;

        const negocio =
          await db.query(
            `
              INSERT INTO negocios (
                nome,
                slug,
                descricao,
                setor,
                whatsapp,
                publicado,
                plano_id,
                fuso_horario
              )
              VALUES (
                'Studio Manaus NFR',
                $1,
                'Cenário isolado de timezone.',
                'Beleza',
                '92999999999',
                TRUE,
                $2,
                'America/Manaus'
              )
              RETURNING id
            `,
            [
              slug,
              base.rows[0].plano_id,
            ]
          );

        negocioSecundarioId =
          Number(
            negocio.rows[0].id
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
            cenario.profissional.id,
            negocioSecundarioId,
          ]
        );

        const servico =
          await db.query(
            `
              INSERT INTO servicos_negocio (
                negocio_id,
                nome,
                descricao,
                valor,
                duracao_minutos
              )
              VALUES (
                $1,
                'Serviço Manaus NFR',
                'Serviço para validar instante absoluto.',
                50,
                60
              )
              RETURNING id
            `,
            [
              negocioSecundarioId,
            ]
          );

        servicoSecundarioId =
          Number(
            servico.rows[0].id
          );

        await db.query(
          `
            INSERT INTO profissional_servicos (
              negocio_id,
              profissional_id,
              servico_id,
              habilitado_por_usuario_id
            )
            VALUES (
              $1,
              $2,
              $3,
              $2
            )
          `,
          [
            negocioSecundarioId,
            cenario.profissional.id,
            servicoSecundarioId,
          ]
        );
      },
      30000
    );

    afterAll(
      async () => {
        try {
          if (
            agendamentoId
          ) {
            await db.query(
              `
                DELETE FROM
                  analytics_eventos
                WHERE agendamento_id =
                  $1
              `,
              [agendamentoId]
            );

            await db.query(
              `
                DELETE FROM
                  agendamentos
                WHERE id = $1
              `,
              [agendamentoId]
            );
          }

          if (
            clientId
          ) {
            await db.query(
              `
                DELETE FROM clientes
                WHERE id = $1
              `,
              [clientId]
            );
          }

          if (
            servicoSecundarioId
          ) {
            await db.query(
              `
                DELETE FROM
                  servicos_negocio
                WHERE id = $1
              `,
              [
                servicoSecundarioId,
              ]
            );
          }

          if (
            negocioSecundarioId
          ) {
            await db.query(
              `
                DELETE FROM negocios
                WHERE id = $1
              `,
              [
                negocioSecundarioId,
              ]
            );
          }

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
      30000
    );

    test(
      "normaliza o booking, compara entre fusos e preserva o instante após correção do IANA",
      async () => {
        const hojeSaoPaulo =
          obterDataHoraNoFuso(
            "America/Sao_Paulo"
          ).data;

        const data =
          adicionarDias(
            hojeSaoPaulo,
            2
          );

        const criado =
          await db.query(
            `
              INSERT INTO agendamentos (
                data,
                horario,
                profissional_id,
                cliente_nome,
                cliente_whatsapp,
                servico_id,
                valor_servico,
                negocio_id,
                status,
                confirmado_em
              )
              VALUES (
                $1,
                '10:00',
                $2,
                'Cliente Timezone',
                '92988887777',
                $3,
                50,
                $4,
                'confirmado',
                NOW()
              )
              RETURNING
                id,
                client_id,
                inicio_previsto_em,
                fuso_horario_snapshot
            `,
            [
              data,
              cenario.profissional.id,
              servicoSecundarioId,
              negocioSecundarioId,
            ]
          );

        agendamentoId =
          Number(
            criado.rows[0].id
          );
        clientId =
          Number(
            criado.rows[0]
              .client_id
          );

        const instanteOriginal =
          new Date(
            criado.rows[0]
              .inicio_previsto_em
          ).toISOString();

        expect(
          criado.rows[0]
            .fuso_horario_snapshot
        ).toBe(
          "America/Manaus"
        );

        const ocupados =
          await agendaPublicaRepository
            .listarAgendamentosOcupados(
              cenario.profissional.id,
              data,
              data,
              null,
              "America/Sao_Paulo"
            );

        expect(
          ocupados
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id:
                String(
                  agendamentoId
                ),
              data,
              horario:
                "11:00",
              fuso_horario_snapshot:
                "America/Manaus",
            }),
          ])
        );

        const disponivel =
          await agendaDisponibilidadeService
            .horarioEstaDisponivel({
              profissionalId:
                cenario.profissional.id,
              negocioId:
                cenario.negocioId,
              duracaoServico:
                60,
              data,
              horario:
                "11:00",
              quantidadeDias:
                7,
              fusoHorario:
                "America/Sao_Paulo",
              ignorarAntecedencia:
                true,
            });

        expect(
          disponivel
        ).toBe(false);

        await db.query(
          `
            UPDATE negocios
            SET fuso_horario =
              'America/Sao_Paulo'
            WHERE id = $1
          `,
          [
            negocioSecundarioId,
          ]
        );

        const preservado =
          await db.query(
            `
              SELECT
                inicio_previsto_em,
                fuso_horario_snapshot
              FROM agendamentos
              WHERE id = $1
            `,
            [agendamentoId]
          );

        expect(
          new Date(
            preservado.rows[0]
              .inicio_previsto_em
          ).toISOString()
        ).toBe(
          instanteOriginal
        );
        expect(
          preservado.rows[0]
            .fuso_horario_snapshot
        ).toBe(
          "America/Manaus"
        );
      }
    );
  }
);
