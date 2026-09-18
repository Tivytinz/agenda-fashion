jest.setTimeout(60000);

jest.mock(
  "../src/services/agendaDisponibilidadeService",
  () => ({
    horarioEstaDisponivel:
      jest.fn().mockResolvedValue(true),
  })
);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function identificador() {
  return `${process.pid}-${Date.now()}-${Math.floor(
    Math.random() * 1000000
  )}`;
}

function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataComDeslocamento(dias) {
  const data = new Date();
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return formatarData(data);
}

function token(usuarioId) {
  return jwt.sign(
    { id: usuarioId },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

describe("reagendamento operacional persistido", () => {
  const usuarios = [];
  let negocioId;
  let servicoId;
  let dono;
  let profissional;
  let outraProfissional;
  let cliente;
  let bookingProfissionalId;
  let bookingDonaId;
  let bookingIniciadoId;
  let bookingPassadoId;
  let futuro;
  let destino;
  let passado;

  beforeAll(async () => {
    const chave = identificador();
    futuro = dataComDeslocamento(2);
    destino = dataComDeslocamento(3);
    passado = dataComDeslocamento(-1);

    const plano = await db.query(
      `SELECT id FROM planos WHERE slug = 'inicial' AND ativo = TRUE LIMIT 1`
    );
    expect(plano.rows[0]?.id).toBeTruthy();

    async function criarUsuario(nome, prefixo) {
      const resultado = await db.query(
        `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES (
            $1,
            $2,
            'hash-de-teste',
            $3
          )
          RETURNING id
        `,
        [
          nome,
          `${prefixo}-${chave}@teste.local`,
          `629${String(
            Date.now() + usuarios.length
          ).slice(-8)}`,
        ]
      );

      usuarios.push(resultado.rows[0].id);
      return resultado.rows[0];
    }

    dono = await criarUsuario(
      "Dona Reagendamento",
      "dona-reagendamento"
    );
    profissional = await criarUsuario(
      "Profissional Reagendamento",
      "prof-reagendamento"
    );
    outraProfissional = await criarUsuario(
      "Outra Reagendamento",
      "outra-reagendamento"
    );
    cliente = await criarUsuario(
      "Cliente Reagendamento",
      "cliente-reagendamento"
    );

    await db.query(
      `
        UPDATE usuarios
        SET
          whatsapp_operacional_consentido_em = NOW(),
          whatsapp_operacional_cancelado_em = NULL
        WHERE id = $1
      `,
      [profissional.id]
    );

    const negocio = await db.query(
      `
        INSERT INTO negocios (
          nome,
          slug,
          plano_id,
          fuso_horario
        )
        VALUES (
          $1,
          $2,
          $3,
          'America/Sao_Paulo'
        )
        RETURNING id
      `,
      [
        "Studio Reagendamento",
        `studio-reagendamento-${chave}`,
        plano.rows[0].id,
      ]
    );

    negocioId = negocio.rows[0].id;

    await db.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES
          ($1, $4, 'dono'),
          ($2, $4, 'profissional'),
          ($3, $4, 'profissional')
      `,
      [
        dono.id,
        profissional.id,
        outraProfissional.id,
        negocioId,
      ]
    );

    const servico = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        )
        VALUES (
          $1,
          'Manicure Reagendamento',
          75,
          60,
          TRUE
        )
        RETURNING id
      `,
      [negocioId]
    );

    servicoId = servico.rows[0].id;

    await db.query(
      `
        INSERT INTO servicos_profissionais (
          negocio_id,
          servico_id,
          profissional_id,
          created_by_user_id
        )
        VALUES
          ($1, $2, $3, $5),
          ($1, $2, $4, $5)
      `,
      [
        negocioId,
        servicoId,
        profissional.id,
        outraProfissional.id,
        dono.id,
      ]
    );

    async function criarAgendamento({
      data,
      horario,
      profissionalId,
    }) {
      const resultado = await db.query(
        `
          INSERT INTO agendamentos (
            negocio_id,
            servico_id,
            profissional_id,
            cliente_id,
            data,
            horario,
            status,
            whatsapp_consentido_em,
            valor_servico,
            duracao_minutos,
            servico_nome,
            antecedencia_cancelamento_horas
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'confirmado',
            NOW(),
            75,
            60,
            'Manicure Reagendamento',
            4
          )
          RETURNING id
        `,
        [
          negocioId,
          servicoId,
          profissionalId,
          cliente.id,
          data,
          horario,
        ]
      );

      return resultado.rows[0].id;
    }

    bookingProfissionalId =
      await criarAgendamento({
        data: futuro,
        horario: "10:00",
        profissionalId: profissional.id,
      });

    bookingDonaId =
      await criarAgendamento({
        data: futuro,
        horario: "11:00",
        profissionalId: profissional.id,
      });

    bookingIniciadoId =
      await criarAgendamento({
        data: passado,
        horario: "09:00",
        profissionalId: profissional.id,
      });

    bookingPassadoId =
      await criarAgendamento({
        data: passado,
        horario: "10:00",
        profissionalId: profissional.id,
      });
  });

  afterAll(async () => {
    try {
      if (negocioId) {
        await db.query(
          `
            DELETE FROM agendamento_reagendamentos
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM whatsapp_mensagens
            WHERE negocio_id = $1
              OR agendamento_id IN (
                SELECT id
                FROM agendamentos
                WHERE negocio_id = $1
              )
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM agendamentos
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM servicos_negocio
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM usuarios_negocios
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM negocios
            WHERE id = $1
          `,
          [negocioId]
        );
      }

      if (usuarios.length > 0) {
        await db.query(
          `
            DELETE FROM clientes
            WHERE usuario_id =
              ANY($1::BIGINT[])
          `,
          [usuarios]
        );

        await db.query(
          `
            DELETE FROM usuarios
            WHERE id =
              ANY($1::BIGINT[])
          `,
          [usuarios]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("CA-AG-16/20: profissional reage própria reserva e preserva snapshots", async () => {
    const resposta = await request(app)
      .patch(
        `/agendamentos/${bookingProfissionalId}/reagendar-operacional`
      )
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        data: destino,
        horario: "14:00",
      });

    expect(resposta.statusCode).toBe(200);
    expect(
      resposta.body.agendamento
    ).toMatchObject({
      id: bookingProfissionalId,
      profissional_id: profissional.id,
      data: destino,
      horario: "14:00",
      servico_id: servicoId,
      servico_nome: "Manicure Reagendamento",
      valor_servico: "75.00",
      duracao_minutos: 60,
      antecedencia_cancelamento_horas: 4,
    });

    const historico = await db.query(
      `
        SELECT
          actor_user_id,
          actor_type,
          previous_profissional_id,
          new_profissional_id,
          TO_CHAR(
            previous_data,
            'YYYY-MM-DD'
          ) AS previous_data,
          TO_CHAR(
            new_data,
            'YYYY-MM-DD'
          ) AS new_data,
          antecedencia_cancelamento_horas_snapshot
        FROM agendamento_reagendamentos
        WHERE agendamento_id = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [bookingProfissionalId]
    );

    expect(historico.rows[0]).toMatchObject({
      actor_user_id: profissional.id,
      actor_type: "PROFESSIONAL",
      previous_profissional_id: profissional.id,
      new_profissional_id: profissional.id,
      previous_data: futuro,
      new_data: destino,
      antecedencia_cancelamento_horas_snapshot: 4,
    });

    const mensagens = await db.query(
      `
        SELECT
          tipo,
          parametros_corpo
        FROM whatsapp_mensagens
        WHERE agendamento_id = $1
        ORDER BY tipo
      `,
      [bookingProfissionalId]
    );

    const tipos =
      new Set(
        mensagens.rows.map(
          (item) => item.tipo
        )
      );

    expect(tipos.has(
      "NOVO_AGENDAMENTO_PROFISSIONAL"
    )).toBe(true);
    expect(tipos.has(
      "CONFIRMACAO_AGENDAMENTO_CLIENTE"
    )).toBe(true);

    for (const mensagem of mensagens.rows) {
      expect(
        JSON.stringify(
          mensagem.parametros_corpo
        )
      ).toContain(
        destino.split("-").reverse().join("/")
      );
      expect(
        JSON.stringify(
          mensagem.parametros_corpo
        )
      ).toContain("14:00");
    }
  });

  test("CA-AG-16: profissional não reage reserva de outra responsável", async () => {
    const resposta = await request(app)
      .patch(
        `/agendamentos/${bookingDonaId}/reagendar-operacional`
      )
      .set(
        "Authorization",
        `Bearer ${token(outraProfissional.id)}`
      )
      .send({
        data: destino,
        horario: "15:00",
      });

    expect(resposta.statusCode).toBe(403);
  });

  test("CA-AG-17: dona transfere reserva para profissional ativa e habilitada", async () => {
    const resposta = await request(app)
      .patch(
        `/agendamentos/${bookingDonaId}/reagendar-operacional`
      )
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      )
      .send({
        data: destino,
        horario: "16:00",
        profissional_id:
          outraProfissional.id,
      });

    expect(resposta.statusCode).toBe(200);
    expect(
      Number(
        resposta.body.agendamento
          .profissional_id
      )
    ).toBe(
      Number(
        outraProfissional.id
      )
    );

    const persistido = await db.query(
      `
        SELECT
          profissional_id,
          servico_id,
          servico_nome,
          valor_servico,
          duracao_minutos,
          antecedencia_cancelamento_horas
        FROM agendamentos
        WHERE id = $1
      `,
      [bookingDonaId]
    );

    expect(persistido.rows[0]).toMatchObject({
      profissional_id:
        outraProfissional.id,
      servico_id:
        servicoId,
      servico_nome:
        "Manicure Reagendamento",
      valor_servico:
        "75.00",
      duracao_minutos:
        60,
      antecedencia_cancelamento_horas:
        4,
    });
  });

  test("CA-AG-18: booking passado e ainda não iniciado pode ser movido para o futuro", async () => {
    const resposta = await request(app)
      .patch(
        `/agendamentos/${bookingPassadoId}/reagendar-operacional`
      )
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        data: destino,
        horario: "17:00",
      });

    expect(resposta.statusCode).toBe(200);
  });

  test("CA-AG-19: depois de iniciar atendimento o reagendamento é bloqueado", async () => {
    const iniciado = await request(app)
      .patch(
        `/agendamentos/${bookingIniciadoId}/atendimento`
      )
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        status: "iniciado",
      });

    expect(iniciado.statusCode).toBe(200);
    expect(
      iniciado.body.agendamento
        .atendimento_iniciado_em
    ).toBeTruthy();

    const resposta = await request(app)
      .patch(
        `/agendamentos/${bookingIniciadoId}/reagendar-operacional`
      )
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        data: destino,
        horario: "18:00",
      });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.body.erro).toMatch(
      /já começou/i
    );
  });
});
