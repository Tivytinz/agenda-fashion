jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");
const planoService = require("../src/services/planoService");

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

describe("ciclo persistido do atendimento", () => {
  const usuarios = [];
  let negocioId;
  let servicoId;
  let dono;
  let profissional;
  let outraProfissional;
  let cliente;
  let agendamentoRealizadoId;
  let agendamentoFaltaId;
  let agendamentoFuturoId;
  let ontem;
  let amanha;

  beforeAll(async () => {
    const chave = identificador();
    ontem = dataComDeslocamento(-1);
    amanha = dataComDeslocamento(1);

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

    dono = await criarUsuario("Dona Lifecycle", "dona-lifecycle");
    profissional = await criarUsuario("Profissional Lifecycle", "prof-lifecycle");
    outraProfissional = await criarUsuario("Outra Profissional", "outra-lifecycle");
    cliente = await criarUsuario("Cliente Lifecycle", "cliente-lifecycle");

    const negocio = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id, fuso_horario)
        VALUES ($1, $2, $3, 'America/Sao_Paulo')
        RETURNING id
      `,
      ["Studio Lifecycle", `studio-lifecycle-${chave}`, plano.rows[0].id]
    );
    negocioId = negocio.rows[0].id;

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $4, 'dono'),
          ($2, $4, 'profissional'),
          ($3, $4, 'profissional')
      `,
      [dono.id, profissional.id, outraProfissional.id, negocioId]
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
        VALUES ($1, 'Manicure Lifecycle', 70, 60, TRUE)
        RETURNING id
      `,
      [negocioId]
    );
    servicoId = servico.rows[0].id;

    async function criarAgendamento(data, horario) {
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
            duracao_minutos
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'agendado', 70, 60)
          RETURNING id
        `,
        [negocioId, servicoId, profissional.id, cliente.id, data, horario]
      );
      return resultado.rows[0].id;
    }

    agendamentoRealizadoId = await criarAgendamento(ontem, "10:00");
    agendamentoFaltaId = await criarAgendamento(ontem, "12:00");
    agendamentoFuturoId = await criarAgendamento(amanha, "10:00");
  });

  afterAll(async () => {
    try {
      if (negocioId) {
        await db.query(
          `DELETE FROM agendamentos WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM servicos_negocio WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM negocios WHERE id = $1`,
          [negocioId]
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

  test("CA-AG-15/23: conclui atendimento ocorrido e bloqueia nova transição terminal", async () => {
    const tokenCliente = token(cliente.id);
    const tokenProfissional = token(profissional.id);
    const tokenOutraProfissional = token(outraProfissional.id);
    const tokenDono = token(dono.id);

    const historicoInicial = await request(app)
      .get("/meus-agendamentos")
      .set("Authorization", `Bearer ${tokenCliente}`);

    expect(historicoInicial.statusCode).toBe(200);
    const itemPassado = historicoInicial.body.agendamentos.find(
      (item) => Number(item.id) === Number(agendamentoRealizadoId)
    );
    expect(itemPassado?.status).toBe("agendado");

    const avaliacaoPrematura = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/avaliar`)
      .set("Authorization", `Bearer ${tokenCliente}`)
      .send({ avaliacao: 5 });

    expect(avaliacaoPrematura.statusCode).toBe(400);
    expect(avaliacaoPrematura.body.erro).toMatch(/marcado como realizado/i);

    const tentativaOutraProfissional = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/atendimento`)
      .set("Authorization", `Bearer ${tokenOutraProfissional}`)
      .send({ status: "realizado" });

    expect(tentativaOutraProfissional.statusCode).toBe(403);

    const tentativaFutura = await request(app)
      .patch(`/agendamentos/${agendamentoFuturoId}/atendimento`)
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({ status: "falta" });

    expect(tentativaFutura.statusCode).toBe(409);

    const realizado = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/atendimento`)
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({ status: "realizado" });

    expect(realizado.statusCode).toBe(200);
    expect(realizado.body.agendamento).toMatchObject({
      id: agendamentoRealizadoId,
      status: "realizado",
      status_atendimento_por: profissional.id,
    });
    expect(realizado.body.agendamento.status_atendimento_em).toBeTruthy();

    const realizadoIdempotente = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/atendimento`)
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({ status: "realizado" });

    expect(realizadoIdempotente.statusCode).toBe(200);

    const trocarTerminal = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/atendimento`)
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({ status: "falta" });

    expect(trocarTerminal.statusCode).toBe(409);

    const avaliacaoValida = await request(app)
      .patch(`/agendamentos/${agendamentoRealizadoId}/avaliar`)
      .set("Authorization", `Bearer ${tokenCliente}`)
      .send({ avaliacao: 5 });

    expect(avaliacaoValida.statusCode).toBe(200);
    expect(avaliacaoValida.body.avaliacao).toBe(5);

    const falta = await request(app)
      .patch(`/agendamentos/${agendamentoFaltaId}/atendimento`)
      .set("Authorization", `Bearer ${tokenDono}`)
      .send({ status: "falta" });

    expect(falta.statusCode).toBe(200);
    expect(falta.body.agendamento).toMatchObject({
      id: agendamentoFaltaId,
      status: "falta",
      status_atendimento_por: dono.id,
    });

    const avaliarFalta = await request(app)
      .patch(`/agendamentos/${agendamentoFaltaId}/avaliar`)
      .set("Authorization", `Bearer ${tokenCliente}`)
      .send({ avaliacao: 4 });

    expect(avaliarFalta.statusCode).toBe(400);

    await expect(
      db.query(
        `UPDATE agendamentos SET avaliacao = 4 WHERE id = $1`,
        [agendamentoFaltaId]
      )
    ).rejects.toMatchObject({ code: "23514" });

    const historicoFinal = await request(app)
      .get("/meus-agendamentos")
      .set("Authorization", `Bearer ${tokenCliente}`);

    expect(historicoFinal.statusCode).toBe(200);
    const porId = new Map(
      historicoFinal.body.agendamentos.map((item) => [Number(item.id), item])
    );

    expect(porId.get(Number(agendamentoRealizadoId))?.status).toBe("realizado");
    expect(porId.get(Number(agendamentoFaltaId))?.status).toBe("falta");
    expect(porId.get(Number(agendamentoFuturoId))?.status).toBe("agendado");

    const usoPlano = await planoService.buscarUsoPlano(
      negocioId,
      db,
      ontem
    );
    const mesReferencia = ontem.slice(0, 7);
    const agendamentosNoMes = [
      { data: ontem, status: "realizado" },
      { data: ontem, status: "falta" },
      { data: amanha, status: "agendado" },
    ].filter((item) => item.data.startsWith(mesReferencia));

    expect(agendamentosNoMes.some((item) => item.status === "falta")).toBe(true);
    expect(usoPlano.utilizados).toBe(agendamentosNoMes.length);
  });
});
