jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function gerarIdentificador() {
  return `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function formatarDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataAmanha() {
  const data = new Date();
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + 1);
  return formatarDataLocal(data);
}

describe("Autorização da agenda profissional", () => {
  const usuariosCriados = [];
  const negociosCriados = [];

  let donoA;
  let profissional;
  let negocioA;
  let servicoA;
  let tokenDonoA;
  let tokenProfissional;
  let dataTeste;

  beforeAll(async () => {
    const identificador = gerarIdentificador();

    const planoResultado = await db.query(
      `
        SELECT id
        FROM planos
        WHERE slug = 'inicial'
          AND ativo = TRUE
        LIMIT 1
      `
    );

    const planoId = planoResultado.rows[0]?.id;
    expect(planoId).toBeTruthy();

    const donoResultado = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        "Dona Segurança Agenda",
        `dona-agenda-${identificador}@teste.local`,
        "hash-de-teste",
        `629${String(Date.now()).slice(-8)}`
      ]
    );

    donoA = donoResultado.rows[0];
    usuariosCriados.push(donoA.id);

    const profissionalResultado = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        "Profissional Segurança Agenda",
        `prof-agenda-${identificador}@teste.local`,
        "hash-de-teste",
        `639${String(Date.now()).slice(-8)}`
      ]
    );

    profissional = profissionalResultado.rows[0];
    usuariosCriados.push(profissional.id);

    const negocioResultado = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [
        "Negócio Segurança Agenda",
        `seguranca-agenda-${identificador}`,
        planoId
      ]
    );

    negocioA = negocioResultado.rows[0];
    negociosCriados.push(negocioA.id);

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $2, 'dono'),
          ($3, $2, 'profissional')
      `,
      [donoA.id, negocioA.id, profissional.id]
    );

    const servicoResultado = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos
        )
        VALUES ($1, $2, 95, 60)
        RETURNING id
      `,
      [negocioA.id, `Serviço Protegido ${identificador}`]
    );

    servicoA = servicoResultado.rows[0];
    dataTeste = dataAmanha();

    await db.query(
      `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_nome,
          cliente_whatsapp,
          data,
          horario,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, '09:00', 'agendado')
      `,
      [
        negocioA.id,
        servicoA.id,
        profissional.id,
        `Cliente Protegida ${identificador}`,
        "62988887777",
        dataTeste
      ]
    );

    tokenDonoA = jwt.sign(
      { id: donoA.id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    tokenProfissional = jwt.sign(
      { id: profissional.id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  });

  afterAll(async () => {
    try {
      if (profissional?.id) {
        await db.query(
          `DELETE FROM bloqueios_horarios WHERE profissional_id = $1`,
          [profissional.id]
        );
      }

      if (negociosCriados.length > 0) {
        await db.query(
          `DELETE FROM agendamentos WHERE negocio_id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );

        await db.query(
          `DELETE FROM negocios WHERE id = ANY($1::BIGINT[])`,
          [negociosCriados]
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

  test("revoga leitura e escrita e não reexpõe PII por outro contexto", async () => {
    const antesDaRevogacao = await request(app)
      .get("/agenda-profissional")
      .set("Authorization", `Bearer ${tokenProfissional}`);

    expect(antesDaRevogacao.statusCode).toBe(200);

    const corpoAntes = JSON.stringify(antesDaRevogacao.body);
    expect(corpoAntes).toContain("Cliente Protegida");
    expect(corpoAntes).toContain("62988887777");
    expect(corpoAntes).toContain("Serviço Protegido");

    const remocao = await request(app)
      .delete(`/profissionais/${profissional.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);

    expect(remocao.statusCode).toBe(200);

    const depoisDaRevogacao = await request(app)
      .get("/agenda-profissional")
      .set("Authorization", `Bearer ${tokenProfissional}`);

    expect(depoisDaRevogacao.statusCode).toBe(403);

    const tentativaBloqueio = await request(app)
      .post("/bloqueios-horario")
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({
        data: dataTeste,
        hora: "11:00"
      });

    expect(tentativaBloqueio.statusCode).toBe(403);

    const bloqueios = await db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM bloqueios_horarios
        WHERE profissional_id = $1
          AND data_bloqueio = $2
          AND TO_CHAR(hora_bloqueio, 'HH24:MI') = '11:00'
      `,
      [profissional.id, dataTeste]
    );

    expect(bloqueios.rows[0].total).toBe(0);

    const agendamentos = await db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM agendamentos
        WHERE negocio_id = $1
          AND profissional_id = $2
      `,
      [negocioA.id, profissional.id]
    );

    expect(agendamentos.rows[0].total).toBe(1);

    const planoResultado = await db.query(
      `
        SELECT id
        FROM planos
        WHERE slug = 'inicial'
          AND ativo = TRUE
        LIMIT 1
      `
    );

    const identificador = gerarIdentificador();
    const negocioBResultado = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [
        "Negócio Contexto B",
        `contexto-b-${identificador}`,
        planoResultado.rows[0].id
      ]
    );

    const negocioB = negocioBResultado.rows[0];
    negociosCriados.push(negocioB.id);

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES ($1, $2, 'dono')
      `,
      [profissional.id, negocioB.id]
    );

    const comOutroContexto = await request(app)
      .get("/agenda-profissional")
      .set("Authorization", `Bearer ${tokenProfissional}`);

    expect(comOutroContexto.statusCode).toBe(200);

    const corpoDepois = JSON.stringify(comOutroContexto.body);
    expect(corpoDepois).not.toContain("Cliente Protegida");
    expect(corpoDepois).not.toContain("62988887777");
    expect(corpoDepois).not.toContain("Serviço Protegido");

    const dia = comOutroContexto.body.agenda.find(
      (item) => item.data === dataTeste
    );
    const horario = dia?.horarios.find((item) => item.hora === "09:00");

    expect(horario).toMatchObject({
      status: "agendado",
      agendamento_id: null,
      cliente_id: null,
      cliente: null,
      cliente_whatsapp: null,
      servico_id: null,
      servico: null,
      valor: null
    });
  });
});
