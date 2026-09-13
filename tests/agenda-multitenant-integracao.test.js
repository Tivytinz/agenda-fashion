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

describe("Isolamento multi-tenant da agenda geral", () => {
  const usuariosCriados = [];
  const negociosCriados = [];

  let donoA;
  let profissionalCompartilhada;
  let negocioA;
  let negocioB;
  let servicoA;
  let servicoB;
  let tokenDonoA;
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
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          whatsapp
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, nome, email
      `,
      [
        "Dona Negócio A",
        `dona-a-${identificador}@teste.local`,
        "hash-de-teste",
        `629${String(Date.now()).slice(-8)}`
      ]
    );

    donoA = donoResultado.rows[0];
    usuariosCriados.push(donoA.id);

    const profissionalResultado = await db.query(
      `
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          whatsapp
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, nome, email
      `,
      [
        "Ana Contexto Duplo",
        `ana-contexto-${identificador}@teste.local`,
        "hash-de-teste",
        `639${String(Date.now()).slice(-8)}`
      ]
    );

    profissionalCompartilhada = profissionalResultado.rows[0];
    usuariosCriados.push(profissionalCompartilhada.id);

    const negocioAResultado = await db.query(
      `
        INSERT INTO negocios (
          nome,
          slug,
          plano_id
        )
        VALUES ($1, $2, $3)
        RETURNING id, nome, slug
      `,
      [
        "Negócio Multi-tenant A",
        `multitenant-a-${identificador}`,
        planoId
      ]
    );

    negocioA = negocioAResultado.rows[0];
    negociosCriados.push(negocioA.id);

    const negocioBResultado = await db.query(
      `
        INSERT INTO negocios (
          nome,
          slug,
          plano_id
        )
        VALUES ($1, $2, $3)
        RETURNING id, nome, slug
      `,
      [
        "Negócio Multi-tenant B",
        `multitenant-b-${identificador}`,
        planoId
      ]
    );

    negocioB = negocioBResultado.rows[0];
    negociosCriados.push(negocioB.id);

    await db.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES
          ($1, $2, 'dono'),
          ($3, $2, 'profissional'),
          ($3, $4, 'dono')
      `,
      [
        donoA.id,
        negocioA.id,
        profissionalCompartilhada.id,
        negocioB.id
      ]
    );

    const servicoAResultado = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos
        )
        VALUES ($1, $2, 80, 60)
        RETURNING id, nome
      `,
      [
        negocioA.id,
        `Serviço Visível A ${identificador}`
      ]
    );

    servicoA = servicoAResultado.rows[0];

    const servicoBResultado = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos
        )
        VALUES ($1, $2, 120, 60)
        RETURNING id, nome
      `,
      [
        negocioB.id,
        `Serviço Privado B ${identificador}`
      ]
    );

    servicoB = servicoBResultado.rows[0];

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
        VALUES
          ($1, $2, $3, $4, $5, $6, '09:00', 'agendado'),
          ($7, $8, $3, $9, $10, $6, '10:00', 'agendado')
      `,
      [
        negocioA.id,
        servicoA.id,
        profissionalCompartilhada.id,
        `Cliente Visível A ${identificador}`,
        "62911112222",
        dataTeste,
        negocioB.id,
        servicoB.id,
        `Cliente Privada B ${identificador}`,
        "62933334444"
      ]
    );

    tokenDonoA = jwt.sign(
      { id: donoA.id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  });

  afterAll(async () => {
    try {
      if (negociosCriados.length > 0) {
        await db.query(
          `
            DELETE FROM agendamentos
            WHERE negocio_id = ANY($1::BIGINT[])
          `,
          [negociosCriados]
        );

        await db.query(
          `
            DELETE FROM negocios
            WHERE id = ANY($1::BIGINT[])
          `,
          [negociosCriados]
        );
      }

      if (usuariosCriados.length > 0) {
        await db.query(
          `
            DELETE FROM usuarios
            WHERE id = ANY($1::BIGINT[])
          `,
          [usuariosCriados]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("mantém ocupação global sem expor dados privados de outro negócio", async () => {
    const resposta = await request(app)
      .get("/agenda-geral")
      .set("Authorization", `Bearer ${tokenDonoA}`);

    expect(resposta.statusCode).toBe(200);

    const dia = resposta.body.agenda.find(
      (item) => item.data === dataTeste
    );

    expect(dia).toBeTruthy();

    const profissional = dia.profissionais.find(
      (item) => Number(item.id) === Number(profissionalCompartilhada.id)
    );

    expect(profissional).toBeTruthy();

    const horarioLocal = profissional.horarios.find(
      (item) => item.hora === "09:00"
    );

    expect(horarioLocal).toMatchObject({
      status: "agendado",
      cliente: expect.stringContaining("Cliente Visível A"),
      servico: expect.stringContaining("Serviço Visível A")
    });

    const horarioOutroNegocio = profissional.horarios.find(
      (item) => item.hora === "10:00"
    );

    expect(horarioOutroNegocio).toEqual({
      hora: "10:00",
      status: "agendado",
      cliente: null,
      servico: null
    });

    const corpoSerializado = JSON.stringify(resposta.body);

    expect(corpoSerializado).not.toContain("Cliente Privada B");
    expect(corpoSerializado).not.toContain("Serviço Privado B");
    expect(corpoSerializado).not.toContain("62933334444");
  });
});
