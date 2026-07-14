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

const agendaPublicaService = require(
  "../src/services/agendamentoPublicoService"
);

const SLUG_TESTE =
  process.env.TEST_NEGOCIO_SLUG ||
  "teste-1";

describe(
  "Concorrência no agendamento público",
  () => {
    let negocio;
    let servico;
    let profissional;

    let clienteA;
    let clienteB;

    let dataDisponivel;
    let horarioDisponivel;

    const agendamentosCriados =
      new Set();

    const identificador =
      `${Date.now()}_${process.pid}`;

    const whatsappA =
      `6291${String(Date.now()).slice(-8)}`;

    const whatsappB =
      `6292${String(Date.now()).slice(-8)}`;

    async function criarClientesDeTeste() {
      const resultado =
        await db.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            whatsapp,
            senha,
            tipo
          )
          VALUES
            (
              $1,
              $2,
              $3,
              '',
              'cliente'
            ),
            (
              $4,
              $5,
              $6,
              '',
              'cliente'
            )
          RETURNING
            id,
            nome,
            whatsapp
          `,
          [
            "Cliente Concorrência A",
            `concorrencia_a_${identificador}@agenda.local`,
            whatsappA,

            "Cliente Concorrência B",
            `concorrencia_b_${identificador}@agenda.local`,
            whatsappB,
          ]
        );

      clienteA =
        resultado.rows[0];

      clienteB =
        resultado.rows[1];
    }

    async function buscarDadosDoTeste() {
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

      const servicoPerfil =
        perfil.body.servicos[0];

      const profissionalPerfil =
        perfil.body.profissionais[0];

      const dados =
        await agendaPublicaService.buscarDadosBaseAgenda({
          slug: SLUG_TESTE,

          servicoId:
            servicoPerfil.id,

          profissionalId:
            profissionalPerfil.id,
        });

      negocio =
        dados.negocio;

      servico =
        dados.servico;

      profissional =
        dados.profissional;
    }

    async function buscarHorarioDisponivel() {
      const disponibilidade =
        await agendaPublicaService.buscarDisponibilidade({
          profissionalId:
            profissional.id,

          duracaoServico:
            servico.duracao_minutos,
        });

      const diaComHorario =
        disponibilidade.find(
          (dia) =>
            Array.isArray(
              dia.horarios
            ) &&
            dia.horarios.length > 0
        );

      expect(
        diaComHorario
      ).toBeTruthy();

      dataDisponivel =
        diaComHorario.data;

      horarioDisponivel =
        diaComHorario.horarios[0];
    }

    function montarDadosAgendamento(
      cliente
    ) {
      return {
        data:
          dataDisponivel,

        horario:
          horarioDisponivel,

        profissionalId:
          profissional.id,

        clienteId:
          cliente.id,

        servicoId:
          servico.id,

        negocioId:
          negocio.id,

        duracaoServico:
          servico.duracao_minutos,

        clienteNome:
          cliente.nome,

        servicoNome:
          servico.nome,

        profissionalNome:
          profissional.nome,

        whatsappProfissional:
          profissional.whatsapp,

        whatsappNegocio:
          negocio.whatsapp_negocio,
      };
    }

    beforeAll(async () => {
      await buscarDadosDoTeste();

      await criarClientesDeTeste();

      await buscarHorarioDisponivel();
    });

    afterAll(async () => {
      const clientesIds = [
        clienteA?.id,
        clienteB?.id,
      ].filter(Boolean);

      if (
        agendamentosCriados.size > 0
      ) {
        const ids = Array.from(
          agendamentosCriados
        );

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

      /*
       * Segurança adicional:
       * remove qualquer agendamento criado
       * para os clientes temporários mesmo
       * que o teste falhe antes de registrar
       * o ID retornado.
       */
      if (clientesIds.length > 0) {
        await db.query(
          `
          DELETE FROM notificacoes
          WHERE agendamento_id IN (
            SELECT id
            FROM agendamentos
            WHERE cliente_id =
              ANY($1::int[])
          )
          `,
          [clientesIds]
        );

        await db.query(
          `
          DELETE FROM agendamentos
          WHERE cliente_id =
            ANY($1::int[])
          `,
          [clientesIds]
        );

        await db.query(
          `
          DELETE FROM usuarios
          WHERE id =
            ANY($1::int[])
            AND tipo = 'cliente'
          `,
          [clientesIds]
        );
      }
    });

    test(
      "permite apenas um agendamento quando duas clientes tentam reservar simultaneamente",
      async () => {
        /*
         * Simula as duas clientes verificando
         * o horário antes de qualquer INSERT.
         *
         * As duas validações devem passar.
         */
        const validacoes =
          await Promise.all([
            agendaPublicaService.validarHorarioDisponivel({
              profissionalId:
                profissional.id,

              data:
                dataDisponivel,

              horario:
                horarioDisponivel,

              duracaoServico:
                servico.duracao_minutos,
            }),

            agendaPublicaService.validarHorarioDisponivel({
              profissionalId:
                profissional.id,

              data:
                dataDisponivel,

              horario:
                horarioDisponivel,

              duracaoServico:
                servico.duracao_minutos,
            }),
          ]);

        expect(
          validacoes
        ).toEqual([
          true,
          true,
        ]);

        /*
         * Depois das duas validações,
         * as duas clientes tentam gravar
         * ao mesmo tempo.
         */
        const resultados =
          await Promise.allSettled([
            agendaPublicaService.criarAgendamento(
              montarDadosAgendamento(
                clienteA
              )
            ),

            agendaPublicaService.criarAgendamento(
              montarDadosAgendamento(
                clienteB
              )
            ),
          ]);

        const sucessos =
          resultados.filter(
            (resultado) =>
              resultado.status ===
              "fulfilled"
          );

        const conflitos =
          resultados.filter(
            (resultado) =>
              resultado.status ===
              "rejected"
          );

        expect(
          sucessos
        ).toHaveLength(1);

        expect(
          conflitos
        ).toHaveLength(1);

        const agendamentoCriado =
          sucessos[0].value;

        agendamentosCriados.add(
          agendamentoCriado.id
        );

        const erroConflito =
          conflitos[0].reason;

        expect(
          erroConflito.statusCode ||
            erroConflito.status
        ).toBe(409);

        expect(
          erroConflito.message
        ).toBe(
          "Esse horário não está mais disponível. Escolha outro horário."
        );

        /*
         * Confirma diretamente no banco:
         * só pode existir um agendamento
         * ativo naquele horário.
         */
        const contagem =
          await db.query(
            `
            SELECT
              COUNT(*)::int AS total
            FROM agendamentos
            WHERE profissional_id = $1
              AND data = $2
              AND TO_CHAR(
                horario::time,
                'HH24:MI'
              ) = $3
              AND status IN (
                'agendado',
                'confirmado'
              )
            `,
            [
              profissional.id,
              dataDisponivel,
              horarioDisponivel,
            ]
          );

        expect(
          contagem.rows[0].total
        ).toBe(1);
      }
    );
  }
);