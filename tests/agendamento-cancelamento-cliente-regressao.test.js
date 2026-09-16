jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function identificador() {
  return `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function dataFutura() {
  const data = new Date();
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + 2);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function token(usuarioId) {
  return jwt.sign(
    { id: usuarioId },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

describe("regressão do cancelamento autenticado da cliente", () => {
  const usuarios = [];
  let negocioId;
  let servicoId;
  let agendamentoId;
  let clienteId;

  beforeAll(async () => {
    const chave = identificador();
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
      return resultado.rows[0].id;
    }

    const donoId = await criarUsuario("Dona Regressão", "dona-regressao");
    const profissionalId = await criarUsuario(
      "Profissional Regressão",
      "prof-regressao"
    );
    clienteId = await criarUsuario("Cliente Regressão", "cliente-regressao");

    const negocio = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id, fuso_horario)
        VALUES ($1, $2, $3, 'America/Sao_Paulo')
        RETURNING id
      `,
      [
        "Studio Regressão Cliente",
        `studio-regressao-cliente-${chave}`,
        plano.rows[0].id,
      ]
    );
    negocioId = negocio.rows[0].id;

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $3, 'dono'),
          ($2, $3, 'profissional')
      `,
      [donoId, profissionalId, negocioId]
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
        VALUES ($1, 'Manicure Regressão', 70, 60, TRUE)
        RETURNING id
      `,
      [negocioId]
    );
    servicoId = servico.rows[0].id;

    const agendamento = await db.query(
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
          $1, $2, $3, $4, $5, '15:00', 'confirmado',
          70, 60, 'Manicure Regressão', 0
        )
        RETURNING id
      `,
      [
        negocioId,
        servicoId,
        profissionalId,
        clienteId,
        dataFutura(),
      ]
    );
    agendamentoId = agendamento.rows[0].id;
  });

  afterAll(async () => {
    try {
      if (negocioId) {
        await db.query(
          `
            DELETE FROM whatsapp_mensagens
            WHERE negocio_id = $1
              OR agendamento_id IN (
                SELECT id FROM agendamentos WHERE negocio_id = $1
              )
          `,
          [negocioId]
        );
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

  test("cliente continua cancelando pelo endpoint original e registra sua própria origem", async () => {
    const resposta = await request(app)
      .patch(`/agendamentos/${agendamentoId}/cancelar`)
      .set("Authorization", `Bearer ${token(clienteId)}`)
      .send({});

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.agendamento).toMatchObject({
      id: agendamentoId,
      status: "cancelado",
      cancelado_por: clienteId,
      cancelamento_origem: "cliente",
      motivo_cancelamento: null,
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
      [agendamentoId]
    );

    expect(persistido.rows[0]).toMatchObject({
      status: "cancelado",
      cancelado_por: clienteId,
      cancelamento_origem: "cliente",
      motivo_cancelamento: null,
    });
    expect(persistido.rows[0].cancelado_em).toBeTruthy();
  });
});
