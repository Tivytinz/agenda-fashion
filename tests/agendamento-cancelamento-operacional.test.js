jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function identificador() {
  return `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
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

describe("cancelamento operacional do agendamento", () => {
  const usuarios = [];
  const negocios = [];
  let negocioId;
  let outroNegocioId;
  let servicoId;
  let dono;
  let profissional;
  let outraProfissional;
  let intruso;
  let cliente;
  let agendamentoDonaId;
  let agendamentoProfissionalId;
  let agendamentoOutraProfissionalId;
  let agendamentoRealizadoId;
  let agendamentoIniciadoId;
  let futuro;
  let passado;

  beforeAll(async () => {
    const chave = identificador();
    futuro = dataComDeslocamento(2);
    passado = dataComDeslocamento(-1);

    const plano = await db.query(
      `SELECT id FROM planos WHERE slug = 'inicial' AND ativo = TRUE LIMIT 1`
    );
    expect(plano.rows[0]?.id).toBeTruthy();

    async function criarUsuario(nome, prefixo) {
      const resultado = await db.query(
        `
          INSERT INTO usuarios (nome, email, senha, whatsapp)
          VALUES ($1, $2, 'hash-de-teste', $3)
          RETURNING id
        `,
        [
          nome,
          `${prefixo}-${chave}@teste.local`,
          `629${String(Date.now() + usuarios.length).slice(-8)}`,
        ]
      );
      usuarios.push(resultado.rows[0].id);
      return resultado.rows[0];
    }

    dono = await criarUsuario("Dona Cancelamento", "dona-cancelamento");
    profissional = await criarUsuario("Profissional Cancelamento", "prof-cancelamento");
    outraProfissional = await criarUsuario("Outra Profissional", "outra-prof-cancelamento");
    intruso = await criarUsuario("Profissional Outro Negócio", "intruso-cancelamento");
    cliente = await criarUsuario("Cliente Cancelamento", "cliente-cancelamento");

    const negocio = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id, fuso_horario)
        VALUES ($1, $2, $3, 'America/Sao_Paulo')
        RETURNING id
      `,
      ["Studio Cancelamento", `studio-cancelamento-${chave}`, plano.rows[0].id]
    );
    negocioId = negocio.rows[0].id;
    negocios.push(negocioId);

    const outroNegocio = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id, fuso_horario)
        VALUES ($1, $2, $3, 'America/Sao_Paulo')
        RETURNING id
      `,
      ["Studio Isolado", `studio-isolado-${chave}`, plano.rows[0].id]
    );
    outroNegocioId = outroNegocio.rows[0].id;
    negocios.push(outroNegocioId);

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $5, 'dono'),
          ($2, $5, 'profissional'),
          ($3, $5, 'profissional'),
          ($4, $6, 'profissional')
      `,
      [
        dono.id,
        profissional.id,
        outraProfissional.id,
        intruso.id,
        negocioId,
        outroNegocioId,
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
        VALUES ($1, 'Manicure Cancelamento', 70, 60, TRUE)
        RETURNING id
      `,
      [negocioId]
    );
    servicoId = servico.rows[0].id;

    async function criarAgendamento({
      profissionalId,
      horario,
      status = "agendado",
      data = futuro,
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
            valor_servico,
            duracao_minutos,
            servico_nome,
            antecedencia_cancelamento_horas
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            70, 60, 'Manicure Cancelamento', 168
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
          status,
        ]
      );
      return resultado.rows[0].id;
    }

    agendamentoDonaId = await criarAgendamento({
      profissionalId: profissional.id,
      horario: "10:00",
    });
    agendamentoProfissionalId = await criarAgendamento({
      profissionalId: profissional.id,
      horario: "11:00",
      status: "confirmado",
    });
    agendamentoOutraProfissionalId = await criarAgendamento({
      profissionalId: outraProfissional.id,
      horario: "12:00",
    });
    agendamentoRealizadoId = await criarAgendamento({
      profissionalId: profissional.id,
      horario: "13:00",
      status: "realizado",
    });
    agendamentoIniciadoId = await criarAgendamento({
      profissionalId: profissional.id,
      horario: "09:00",
      status: "confirmado",
      data: passado,
    });
  });

  afterAll(async () => {
    try {
      if (negocios.length > 0) {
        await db.query(
          `
            DELETE FROM analytics_eventos
            WHERE target_business_id =
              ANY($1::BIGINT[])
          `,
          [negocios]
        );

        await db.query(
          `
            DELETE FROM whatsapp_mensagens
            WHERE negocio_id = ANY($1::BIGINT[])
              OR agendamento_id IN (
                SELECT id
                FROM agendamentos
                WHERE negocio_id = ANY($1::BIGINT[])
              )
          `,
          [negocios]
        );
        await db.query(
          `DELETE FROM agendamentos WHERE negocio_id = ANY($1::BIGINT[])`,
          [negocios]
        );
        await db.query(
          `DELETE FROM servicos_negocio WHERE negocio_id = ANY($1::BIGINT[])`,
          [negocios]
        );
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = ANY($1::BIGINT[])`,
          [negocios]
        );
        await db.query(
          `DELETE FROM negocios WHERE id = ANY($1::BIGINT[])`,
          [negocios]
        );
      }

      if (usuarios.length > 0) {
        await db.query(
          `DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])`,
          [usuarios]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("dona cancela booking futuro, registra auditoria e ignora a antecedência da cliente", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoDonaId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(dono.id)}`)
      .send({
        motivo_tipo: "profissional_indisponivel",
        motivo: null,
      });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.agendamento).toMatchObject({
      id: agendamentoDonaId,
      status: "cancelado",
      cancelado_por: dono.id,
      cancelamento_origem: "negocio",
      motivo_cancelamento: "Profissional indisponível",
    });

    const persistido = await db.query(
      `
        SELECT
          status,
          cancelado_por,
          cancelamento_origem,
          motivo_cancelamento,
          cancelado_em
        FROM agendamentos
        WHERE id = $1
      `,
      [agendamentoDonaId]
    );

    expect(persistido.rows[0]).toMatchObject({
      status: "cancelado",
      cancelado_por: dono.id,
      cancelamento_origem: "negocio",
      motivo_cancelamento: "Profissional indisponível",
    });
    expect(persistido.rows[0].cancelado_em).toBeTruthy();

    const evento = await db.query(
      `
        SELECT
          event_uuid::TEXT AS event_id,
          occurred_at,
          origem,
          actor_user_id,
          actor_business_id,
          propriedades
        FROM analytics_eventos
        WHERE agendamento_id = $1
          AND nome = 'booking_cancelled'
        ORDER BY id DESC
        LIMIT 1
      `,
      [agendamentoDonaId]
    );

    expect(evento.rows[0]).toMatchObject({
      origem: "backend",
      actor_user_id: dono.id,
      actor_business_id: negocioId,
      propriedades: expect.objectContaining({
        business_id: Number(negocioId),
        professional_id: Number(profissional.id),
        booking_id: Number(agendamentoDonaId),
        service_id: Number(servicoId),
        actor_type: "OWNER",
        actor_id: Number(dono.id),
        cancellation_reason:
          "Profissional indisponível",
      }),
    });
    expect(evento.rows[0].event_id).toMatch(
      /^[0-9a-f-]{36}$/i
    );
    expect(evento.rows[0].occurred_at).toBeTruthy();

    const repeticao = await request(app)
      .patch(`/agendamentos/${agendamentoDonaId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(dono.id)}`)
      .send({ motivo: "Outro motivo" });

    expect(repeticao.statusCode).toBe(200);
    expect(repeticao.body.mensagem).toMatch(/já estava cancelado/i);
    expect(repeticao.body.agendamento.motivo_cancelamento)
      .toBe("Profissional indisponível");
  });

  test("profissional cancela o próprio booking", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoProfissionalId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(profissional.id)}`)
      .send({
        motivo_tipo: "profissional_indisponivel",
        motivo: null,
      });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.agendamento).toMatchObject({
      id: agendamentoProfissionalId,
      status: "cancelado",
      cancelado_por: profissional.id,
      cancelamento_origem: "negocio",
      motivo_cancelamento: "Profissional indisponível",
    });

    const evento = await db.query(
      `
        SELECT propriedades
        FROM analytics_eventos
        WHERE agendamento_id = $1
          AND nome = 'booking_cancelled'
        ORDER BY id DESC
        LIMIT 1
      `,
      [agendamentoProfissionalId]
    );

    expect(
      evento.rows[0]?.propriedades
    ).toMatchObject({
      actor_type: "PROFESSIONAL",
      actor_id: Number(profissional.id),
      cancellation_reason:
        "Profissional indisponível",
    });
  });

  test("CA-AG-11: dona cancela booking ainda confirmado mesmo após o início", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoIniciadoId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(dono.id)}`)
      .send({
        motivo_tipo: "atendimento_interrompido",
        motivo: "Falha elétrica",
      });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.agendamento).toMatchObject({
      id: agendamentoIniciadoId,
      status: "cancelado",
      cancelado_por: dono.id,
      motivo_cancelamento:
        "Atendimento interrompido antes da conclusão: Falha elétrica",
    });
  });

  test("profissional não cancela booking atribuído a outra profissional", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoOutraProfissionalId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(profissional.id)}`)
      .send({});

    expect(resposta.statusCode).toBe(403);

    const persistido = await db.query(
      `SELECT status FROM agendamentos WHERE id = $1`,
      [agendamentoOutraProfissionalId]
    );
    expect(persistido.rows[0]?.status).toBe("agendado");
  });

  test("usuário de outro negócio não descobre nem cancela o compromisso", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoOutraProfissionalId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(intruso.id)}`)
      .send({});

    expect(resposta.statusCode).toBe(404);
  });

  test("status terminal não volta para cancelado", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/cancelar-operacional`)
      .set("Authorization", `Bearer ${token(dono.id)}`)
      .send({});

    expect(resposta.statusCode).toBe(409);

    const persistido = await db.query(
      `SELECT status FROM agendamentos WHERE id = $1`,
      [agendamentoRealizadoId]
    );
    expect(persistido.rows[0]?.status).toBe("realizado");
  });
});
