jest.setTimeout(30000);

const db = require("../src/db/db");

function gerarSufixoUnico() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

describe("integridade do vínculo profissional-negócio no agendamento", () => {
  const sufixo = gerarSufixoUnico();
  const usuariosCriados = [];
  const negociosCriados = [];
  const agendamentosCriados = [];
  let planoId;
  let dono;
  let profissional;
  let cliente;
  let negocio;
  let servicoId;

  async function criarUsuario(nome, marcador, indice) {
    const resultado = await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        whatsapp
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        nome,
        `${marcador}.${sufixo}@teste.local`,
        "hash-de-teste",
        `6298888${String(sufixo).slice(-3)}${indice}`.slice(0, 11),
      ]
    );

    usuariosCriados.push(resultado.rows[0].id);
    return resultado.rows[0];
  }

  beforeAll(async () => {
    const plano = await db.query(
      `
      INSERT INTO planos (
        nome,
        slug,
        valor,
        capacidade_agendamentos,
        limite_profissionais,
        limite_servicos,
        destaque,
        ativo
      )
      VALUES ($1, $2, 0, 100, 5, 10, FALSE, TRUE)
      RETURNING id
      `,
      [
        "Plano Teste Vínculo",
        `teste-vinculo-${sufixo}`,
      ]
    );
    planoId = plano.rows[0].id;

    dono = await criarUsuario("Dona Vínculo", "dona-vinculo", 1);
    profissional = await criarUsuario("Profissional Vínculo", "prof-vinculo", 2);
    cliente = await criarUsuario("Cliente Vínculo", "cliente-vinculo", 3);

    const negocioCriado = await db.query(
      `
      INSERT INTO negocios (
        nome,
        slug,
        plano_id
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [
        "Negócio Teste Vínculo",
        `negocio-vinculo-${sufixo}`,
        planoId,
      ]
    );
    negocio = negocioCriado.rows[0];
    negociosCriados.push(negocio.id);

    await db.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel
      )
      VALUES
        ($1, $3, 'dono'),
        ($2, $3, 'profissional')
      `,
      [dono.id, profissional.id, negocio.id]
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
      VALUES ($1, $2, 50, 60, TRUE)
      RETURNING id
      `,
      [negocio.id, `Serviço vínculo ${sufixo}`]
    );
    servicoId = servico.rows[0].id;
  });

  afterAll(async () => {
    try {
      if (agendamentosCriados.length > 0) {
        await db.query(
          `DELETE FROM agendamentos WHERE id = ANY($1::BIGINT[])`,
          [agendamentosCriados]
        );
      }

      if (negociosCriados.length > 0) {
        await db.query(
          `DELETE FROM negocios WHERE id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );
      }

      if (planoId) {
        await db.query(
          `DELETE FROM planos WHERE id = $1`,
          [planoId]
        );
      }

      if (usuariosCriados.length > 0) {
        await db.query(
          `DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])`,
          [usuariosCriados]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("permite agendamento quando o vínculo está ativo", async () => {
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
      VALUES ($1, $2, $3, $4, CURRENT_DATE + 2, '09:00', 'agendado', 50, 60)
      RETURNING id
      `,
      [negocio.id, servicoId, profissional.id, cliente.id]
    );

    agendamentosCriados.push(resultado.rows[0].id);
    expect(resultado.rows[0].id).toBeTruthy();
  });

  test("rejeita novo compromisso depois que o vínculo é removido", async () => {
    await db.query(
      `
      DELETE FROM agendamentos
      WHERE id = ANY($1::BIGINT[])
      `,
      [agendamentosCriados]
    );
    agendamentosCriados.length = 0;

    await db.query(
      `
      DELETE FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      `,
      [profissional.id, negocio.id]
    );

    await expect(
      db.query(
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
        VALUES ($1, $2, $3, $4, CURRENT_DATE + 3, '10:00', 'agendado', 50, 60)
        RETURNING id
        `,
        [negocio.id, servicoId, profissional.id, cliente.id]
      )
    ).rejects.toMatchObject({
      code: "23503",
      constraint: "agendamentos_profissional_negocio_vinculo",
    });
  });
});
