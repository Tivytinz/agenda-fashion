jest.setTimeout(30000);

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "privacy-wave-jwt-secret-with-at-least-32-characters";

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const db = require("../src/db/db");

function sufixoUnico() {
  return `${Date.now()}${Math.floor(
    Math.random() * 100000
  )}`;
}

describe("Wave 8 - privacidade e encerramento P0", () => {
  const usuarios = [];
  const negocios = [];
  const agendamentos = [];
  const clientes = [];
  const sufixo = sufixoUnico();
  let contador = 0;
  let planoGratis;
  let planoPago;

  function token(usuarioId) {
    return jwt.sign(
      { id: usuarioId },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  }

  async function criarUsuario(rotulo) {
    contador += 1;
    const result = await db.query(
      `
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          whatsapp
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, nome, email, whatsapp
      `,
      [
        `Pessoa ${rotulo}`,
        `${rotulo.toLowerCase()}.${sufixo}.${contador}@teste.local`,
        "hash-de-teste",
        `62${String(
          900000000 + contador
        ).slice(-9)}`,
      ]
    );

    usuarios.push(result.rows[0].id);
    return result.rows[0];
  }

  async function criarNegocio(dona, rotulo) {
    const result = await db.query(
      `
        INSERT INTO negocios (
          nome,
          slug,
          plano_id,
          publicado
        )
        VALUES ($1, $2, $3, TRUE)
        RETURNING id, nome, slug
      `,
      [
        `Studio Privacy ${rotulo}`,
        `privacy-${rotulo.toLowerCase()}-${sufixo}-${contador}`,
        planoGratis.id,
      ]
    );

    const negocio = result.rows[0];
    negocios.push(negocio.id);

    await db.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES ($1, $2, 'dono')
      `,
      [dona.id, negocio.id]
    );

    return negocio;
  }

  async function criarServico(negocioId) {
    const result = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        )
        VALUES ($1, 'Manicure', 50, 60, TRUE)
        RETURNING id
      `,
      [negocioId]
    );

    return result.rows[0];
  }

  async function criarClienteInterno(usuario) {
    const result = await db.query(
      `
        INSERT INTO clientes (
          usuario_id,
          nome,
          whatsapp_normalizado,
          origem
        )
        VALUES ($1, $2, $3, 'conta')
        RETURNING id
      `,
      [
        usuario.id,
        usuario.nome,
        usuario.whatsapp,
      ]
    );

    clientes.push(result.rows[0].id);
    return result.rows[0];
  }

  async function criarAgendamentoConfirmado({
    negocio,
    servico,
    profissional,
    cliente,
    client,
  }) {
    const result = await db.query(
      `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_id,
          client_id,
          cliente_nome,
          cliente_whatsapp,
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
          CURRENT_DATE + 10,
          '14:00',
          'confirmado',
          50,
          60,
          'Manicure',
          2
        )
        RETURNING id
      `,
      [
        negocio.id,
        servico.id,
        profissional.id,
        cliente.id,
        client.id,
        cliente.nome,
        cliente.whatsapp,
      ]
    );

    agendamentos.push(result.rows[0].id);
    return result.rows[0];
  }

  beforeAll(async () => {
    const planos = await db.query(
      `
        SELECT id, slug
        FROM planos
        WHERE ativo = TRUE
        ORDER BY
          CASE WHEN slug = 'inicial' THEN 0 ELSE 1 END,
          id
      `
    );

    planoGratis = planos.rows.find(
      (item) => item.slug === "inicial"
    );
    planoPago = planos.rows.find(
      (item) => item.slug !== "inicial"
    );

    expect(planoGratis?.id).toBeTruthy();
    expect(planoPago?.id).toBeTruthy();
  });

  afterAll(async () => {
    try {
      if (agendamentos.length > 0) {
        await db.query(
          "DELETE FROM agendamentos WHERE id = ANY($1::BIGINT[])",
          [agendamentos]
        );
      }

      if (clientes.length > 0) {
        await db.query(
          "DELETE FROM clientes WHERE id = ANY($1::BIGINT[])",
          [clientes]
        );
      }

      if (negocios.length > 0) {
        await db.query(
          "DELETE FROM negocios WHERE id = ANY($1::BIGINT[])",
          [negocios]
        );
      }

      if (usuarios.length > 0) {
        await db.query(
          "DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])",
          [usuarios]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("CA-PRV-01/02: bloqueia pendências e arquiva preservando histórico e cancelando convites pendentes", async () => {
    const dona = await criarUsuario("Dona Arquivo");
    const cliente = await criarUsuario("Cliente Arquivo");
    const convidada = await criarUsuario("Convidada Arquivo");
    const negocio = await criarNegocio(dona, "arquivo");
    const servico = await criarServico(negocio.id);
    const client = await criarClienteInterno(cliente);
    const booking = await criarAgendamentoConfirmado({
      negocio,
      servico,
      profissional: dona,
      cliente,
      client,
    });

    const convite = await db.query(
      `
        INSERT INTO convites_profissionais (
          negocio_id,
          usuario_convidado_id,
          convidado_por_usuario_id,
          expira_em
        )
        VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
        RETURNING id
      `,
      [negocio.id, convidada.id, dona.id]
    );

    const bloqueadoBooking = await request(app)
      .post("/negocio/encerrar")
      .set("Authorization", `Bearer ${token(dona.id)}`);

    expect(bloqueadoBooking.statusCode).toBe(409);
    expect(bloqueadoBooking.body.codigo)
      .toBe("ENCERRAMENTO_COM_PENDENCIAS");
    expect(bloqueadoBooking.body.pendencias)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          codigo: "AGENDAMENTOS_CONFIRMADOS",
        }),
      ]));

    await db.query(
      `
        UPDATE agendamentos
        SET status = 'cancelado', cancelado_em = NOW()
        WHERE id = $1
      `,
      [booking.id]
    );

    const assinatura = await db.query(
      `
        INSERT INTO assinaturas (
          negocio_id,
          plano_id,
          status,
          forma_pagamento,
          valor,
          ativo
        )
        VALUES ($1, $2, 'ACTIVE', 'pix', 49.90, TRUE)
        RETURNING id
      `,
      [negocio.id, planoPago.id]
    );

    const bloqueadoFinanceiro = await request(app)
      .post("/negocio/encerrar")
      .set("Authorization", `Bearer ${token(dona.id)}`);

    expect(bloqueadoFinanceiro.statusCode).toBe(409);
    expect(bloqueadoFinanceiro.body.pendencias)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          codigo: "ACESSO_PAGO_ATIVO",
        }),
      ]));

    await db.query(
      `
        UPDATE assinaturas
        SET ativo = FALSE, status = 'CANCELED'
        WHERE id = $1
      `,
      [assinatura.rows[0].id]
    );

    const encerrado = await request(app)
      .post("/negocio/encerrar")
      .set("Authorization", `Bearer ${token(dona.id)}`);

    expect(encerrado.statusCode).toBe(200);
    expect(encerrado.body.negocio).toMatchObject({
      ativo: false,
      publicado: false,
      motivo_arquivamento: "encerramento_voluntario",
    });

    const [estadoNegocio, estadoConvite, historico] =
      await Promise.all([
        db.query(
          `
            SELECT ativo, publicado, arquivado_em
            FROM negocios
            WHERE id = $1
          `,
          [negocio.id]
        ),
        db.query(
          `
            SELECT status
            FROM convites_profissionais
            WHERE id = $1
          `,
          [convite.rows[0].id]
        ),
        db.query(
          `
            SELECT status
            FROM agendamentos
            WHERE id = $1
          `,
          [booking.id]
        ),
      ]);

    expect(estadoNegocio.rows[0]).toMatchObject({
      ativo: false,
      publicado: false,
    });
    expect(estadoNegocio.rows[0].arquivado_em).toBeTruthy();
    expect(estadoConvite.rows[0].status).toBe("cancelado");
    expect(historico.rows[0].status).toBe("cancelado");
  });

  test("CA-PRV-04: bloqueia encerramento definitivo de profissional com reserva confirmada", async () => {
    const dona = await criarUsuario("Dona Prof");
    const profissional = await criarUsuario("Profissional Reserva");
    const cliente = await criarUsuario("Cliente Prof");
    const negocio = await criarNegocio(dona, "profissional");
    const servico = await criarServico(negocio.id);
    const client = await criarClienteInterno(cliente);

    await db.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES ($1, $2, 'profissional')
      `,
      [profissional.id, negocio.id]
    );

    const booking = await criarAgendamentoConfirmado({
      negocio,
      servico,
      profissional,
      cliente,
      client,
    });

    const bloqueado = await request(app)
      .delete("/conta")
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      );

    expect(bloqueado.statusCode).toBe(409);
    expect(bloqueado.body.codigo)
      .toBe("PROFISSIONAL_COM_AGENDAMENTOS");

    const aindaAtiva = await db.query(
      "SELECT ativo FROM usuarios WHERE id = $1",
      [profissional.id]
    );
    expect(aindaAtiva.rows[0].ativo).toBe(true);

    await db.query(
      `
        UPDATE agendamentos
        SET status = 'cancelado', cancelado_em = NOW()
        WHERE id = $1
      `,
      [booking.id]
    );

    const encerrada = await request(app)
      .delete("/conta")
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      );

    expect(encerrada.statusCode).toBe(200);

    const estado = await db.query(
      `
        SELECT ativo, encerrado_definitivo_em
        FROM usuarios
        WHERE id = $1
      `,
      [profissional.id]
    );

    expect(estado.rows[0].ativo).toBe(false);
    expect(
      estado.rows[0].encerrado_definitivo_em
    ).toBeTruthy();
  });

  test("CA-PRV-05: desativa cliente sem cancelar reserva e preserva acesso seguro", async () => {
    const dona = await criarUsuario("Dona Cliente");
    const cliente = await criarUsuario("Cliente Desativado");
    const negocio = await criarNegocio(dona, "cliente");
    const servico = await criarServico(negocio.id);
    const client = await criarClienteInterno(cliente);
    const booking = await criarAgendamentoConfirmado({
      negocio,
      servico,
      profissional: dona,
      cliente,
      client,
    });

    const desativada = await request(app)
      .post("/conta/desativar")
      .set(
        "Authorization",
        `Bearer ${token(cliente.id)}`
      );

    expect(desativada.statusCode).toBe(200);
    expect(desativada.body.conta.ativo).toBe(false);
    expect(desativada.body.reservas_acesso).toHaveLength(1);
    expect(
      desativada.body.reservas_acesso[0].caminho
    ).toMatch(
      new RegExp(
        `^/agendamento-acesso/${booking.id}\\?token=`
      )
    );

    const preservados = await db.query(
      `
        SELECT
          a.status,
          a.client_id,
          c.usuario_id,
          u.ativo
        FROM agendamentos a
        INNER JOIN clientes c
          ON c.id = a.client_id
        INNER JOIN usuarios u
          ON u.id = a.cliente_id
        WHERE a.id = $1
      `,
      [booking.id]
    );

    expect(preservados.rows[0]).toMatchObject({
      status: "confirmado",
      usuario_id: String(cliente.id),
      ativo: false,
    });
    expect(preservados.rows[0].client_id).toBeTruthy();

    const acesso =
      desativada.body.reservas_acesso[0].acesso;

    const consulta = await request(app)
      .get(
        `/agendamentos/${booking.id}/acesso-cliente-desativado`
      )
      .query({ token: acesso });

    expect(consulta.statusCode).toBe(200);
    expect(consulta.body.agendamento).toMatchObject({
      id: String(booking.id),
      status: "confirmado",
      servico_nome: "Manicure",
    });

    const cancelada = await request(app)
      .patch(
        `/agendamentos/${booking.id}/cancelar-acesso-cliente-desativado`
      )
      .send({ token: acesso });

    expect(cancelada.statusCode).toBe(200);

    const estadoFinal = await db.query(
      "SELECT status FROM agendamentos WHERE id = $1",
      [booking.id]
    );
    expect(estadoFinal.rows[0].status).toBe("cancelado");
  });

  test("CA-PRV-06: encerramento definitivo da proprietária arquiva negócio seguro na mesma transação", async () => {
    const dona = await criarUsuario("Dona Exclusao");
    const negocio = await criarNegocio(dona, "exclusao");

    const encerrada = await request(app)
      .delete("/conta")
      .set(
        "Authorization",
        `Bearer ${token(dona.id)}`
      );

    expect(encerrada.statusCode).toBe(200);
    expect(
      encerrada.body.negocio_arquivado
    ).toMatchObject({
      id: String(negocio.id),
      ativo: false,
      publicado: false,
      motivo_arquivamento: "exclusao_proprietaria",
    });

    const [conta, negocioEstado] =
      await Promise.all([
        db.query(
          `
            SELECT
              ativo,
              encerrado_definitivo_em
            FROM usuarios
            WHERE id = $1
          `,
          [dona.id]
        ),
        db.query(
          `
            SELECT
              ativo,
              publicado,
              arquivado_em,
              motivo_arquivamento
            FROM negocios
            WHERE id = $1
          `,
          [negocio.id]
        ),
      ]);

    expect(conta.rows[0].ativo).toBe(false);
    expect(
      conta.rows[0].encerrado_definitivo_em
    ).toBeTruthy();
    expect(negocioEstado.rows[0]).toMatchObject({
      ativo: false,
      publicado: false,
      motivo_arquivamento: "exclusao_proprietaria",
    });
    expect(
      negocioEstado.rows[0].arquivado_em
    ).toBeTruthy();
  });
});
