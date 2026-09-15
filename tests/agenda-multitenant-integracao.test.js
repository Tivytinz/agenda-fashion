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

describe("Agenda Geral multi-tenant", () => {
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

    async function criarUsuario(nome, prefixo, whatsapp) {
      const resultado = await db.query(
        `
          INSERT INTO usuarios (nome, email, senha, whatsapp)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [
          nome,
          `${prefixo}-${identificador}@teste.local`,
          "hash-de-teste",
          whatsapp,
        ]
      );

      usuariosCriados.push(resultado.rows[0].id);
      return resultado.rows[0];
    }

    donoA = await criarUsuario(
      "Dona Negócio A",
      "dona-negocio-a",
      `629${String(Date.now()).slice(-8)}`
    );
    profissionalCompartilhada = await criarUsuario(
      "Profissional Compartilhada",
      "profissional-compartilhada",
      `649${String(Date.now()).slice(-8)}`
    );

    async function criarNegocio(nome, slug) {
      const resultado = await db.query(
        `
          INSERT INTO negocios (nome, slug, plano_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [nome, slug, planoId]
      );

      negociosCriados.push(resultado.rows[0].id);
      return resultado.rows[0];
    }

    negocioA = await criarNegocio(
      "Negócio A Multi Tenant",
      `negocio-a-multi-${identificador}`
    );
    negocioB = await criarNegocio(
      "Negócio B Multi Tenant",
      `negocio-b-multi-${identificador}`
    );

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $2, 'dono'),
          ($3, $2, 'profissional'),
          ($3, $4, 'dono')
      `,
      [
        donoA.id,
        negocioA.id,
        profissionalCompartilhada.id,
        negocioB.id,
      ]
    );

    async function criarServico(negocioId, nome) {
      const resultado = await db.query(
        `
          INSERT INTO servicos_negocio (
            negocio_id,
            nome,
            valor,
            duracao_minutos
          )
          VALUES ($1, $2, 80, 60)
          RETURNING id
        `,
        [negocioId, nome]
      );

      return resultado.rows[0];
    }

    servicoA = await criarServico(
      negocioA.id,
      `Serviço Visível A ${identificador}`
    );
    servicoB = await criarServico(
      negocioB.id,
      `Serviço Privado B ${identificador}`
    );

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
        "62933334444",
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
          `DELETE FROM agendamentos WHERE negocio_id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );
        await db.query(
          `DELETE FROM servicos_negocio WHERE negocio_id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = ANY($1::BIGINT[])`,
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

  test("mantém ocupação física entre negócios sem expor PII de outro tenant", async () => {
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

    expect(horarioOutroNegocio).toMatchObject({
      hora: "10:00",
      status: "agendado",
      agendamento_id: null,
      cliente: null,
      servico: null,
      pode_marcar_falta: false,
      pode_marcar_realizado: false,
    });

    const corpoSerializado = JSON.stringify(resposta.body);

    expect(corpoSerializado).not.toContain("Cliente Privada B");
    expect(corpoSerializado).not.toContain("Serviço Privado B");
    expect(corpoSerializado).not.toContain("62933334444");
  });
});
