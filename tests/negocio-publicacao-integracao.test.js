jest.setTimeout(30000);

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "wave-7-jwt-secret-with-at-least-32-characters";

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const db = require("../src/db/db");
const planoRepository = require(
  "../src/repositories/planoRepository"
);

function sufixoUnico() {
  return `${Date.now()}${Math.floor(
    Math.random() * 100000
  )}`;
}

describe("Wave 7 - negócio, onboarding e publicação P0", () => {
  const usuariosCriados = [];
  const negociosCriados = [];
  const sufixo = sufixoUnico();
  let indice = 0;

  function token(usuarioId) {
    return jwt.sign(
      { id: usuarioId },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  }

  async function criarUsuario(rotulo) {
    indice += 1;
    const resultado = await db.query(
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
        `${rotulo.toLowerCase()}.${sufixo}.${indice}@teste.local`,
        "hash-de-teste",
        `62${String(
          Number(String(Date.now()).slice(-8)) + indice
        ).padStart(9, "0").slice(-9)}`,
      ]
    );

    const usuario = resultado.rows[0];
    usuariosCriados.push(usuario.id);
    return usuario;
  }

  function dadosNegocio(rotulo) {
    return {
      nome: `Studio Wave 7 ${rotulo} ${sufixo}`,
      descricao: "",
      especialidades: ["Unhas"],
      whatsapp: "62999999999",
      cidade: "Goiânia",
      estado: "GO",
      bairro: "Centro",
      endereco: "Rua das Flores",
      numero: "10",
      complemento: "",
      cep: "74000123",
      localizacao_url:
        "https://maps.google.com/?q=goiania",
    };
  }

  async function criarNegocio(usuario, rotulo) {
    const resposta = await request(app)
      .post("/criar-negocio")
      .set(
        "Authorization",
        `Bearer ${token(usuario.id)}`
      )
      .send(dadosNegocio(rotulo));

    if (resposta.body?.negocio?.id) {
      negociosCriados.push(
        resposta.body.negocio.id
      );
    }

    return resposta;
  }

  async function criarPrimeiroServico(
    usuario,
    nome = "Manicure"
  ) {
    return request(app)
      .post("/servicos")
      .set(
        "Authorization",
        `Bearer ${token(usuario.id)}`
      )
      .send({
        nome,
        descricao: "",
        valor: 40,
        duracao_minutos: 60,
        categoria: "unha",
        ativo: true,
      });
  }

  afterAll(async () => {
    try {
      if (negociosCriados.length > 0) {
        await db.query(
          "DELETE FROM negocios WHERE id = ANY($1::BIGINT[])",
          [negociosCriados]
        );
      }

      if (usuariosCriados.length > 0) {
        await db.query(
          "DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])",
          [usuariosCriados]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("CA-NEG-01: primeiro negócio vincula a proprietária ativa e consome uma vaga", async () => {
    const usuario =
      await criarUsuario("PrimeiroNegocio");

    const resposta =
      await criarNegocio(
        usuario,
        "Primeiro"
      );

    expect(resposta.statusCode).toBe(201);
    expect(resposta.body).toMatchObject({
      temNegocio: true,
      negocio: {
        papel: "dono",
        publicado: false,
      },
    });

    const vinculo = await db.query(
      `
        SELECT papel, ativo
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND negocio_id = $2
      `,
      [
        usuario.id,
        resposta.body.negocio.id,
      ]
    );

    expect(vinculo.rows).toEqual([
      {
        papel: "dono",
        ativo: true,
      },
    ]);

    const uso =
      await planoRepository.buscarUsoPlano(
        resposta.body.negocio.id
      );

    expect(
      Number(uso.profissionais_utilizados)
    ).toBe(1);
  });

  test("CA-NEG-02: bloqueia segundo negócio operacional e ignora negócio arquivado", async () => {
    const usuario =
      await criarUsuario("SegundoNegocio");

    const primeiro =
      await criarNegocio(
        usuario,
        "Operacional"
      );

    expect(primeiro.statusCode).toBe(201);

    const bloqueado =
      await criarNegocio(
        usuario,
        "Duplicado"
      );

    expect(bloqueado.statusCode).toBe(409);
    expect(bloqueado.body.erro).toMatch(
      /já possui um negócio/i
    );

    await db.query(
      `
        UPDATE negocios
        SET ativo = FALSE
        WHERE id = $1
      `,
      [primeiro.body.negocio.id]
    );

    const depoisDoArquivo =
      await criarNegocio(
        usuario,
        "Depois do arquivo"
      );

    expect(depoisDoArquivo.statusCode).toBe(
      201
    );
    expect(
      depoisDoArquivo.body.negocio.id
    ).not.toBe(
      primeiro.body.negocio.id
    );
  });

  test("CA-NEG-04: primeiro serviço torna negócio elegível automaticamente publicado e descobrível", async () => {
    const usuario =
      await criarUsuario("PublicacaoAutomatica");

    const negocio =
      await criarNegocio(
        usuario,
        "Automático"
      );

    expect(negocio.statusCode).toBe(201);
    expect(
      negocio.body.negocio.publicado
    ).toBe(false);

    const servico =
      await criarPrimeiroServico(
        usuario
      );

    expect(servico.statusCode).toBe(201);
    expect(servico.body.publicacao).toMatchObject({
      publicado: true,
      pode_publicar: true,
    });

    const persistido = await db.query(
      `
        SELECT
          publicado,
          primeira_publicacao_em,
          despublicado_manual_em
        FROM negocios
        WHERE id = $1
      `,
      [negocio.body.negocio.id]
    );

    expect(persistido.rows[0]).toMatchObject({
      publicado: true,
      despublicado_manual_em: null,
    });
    expect(
      persistido.rows[0]
        .primeira_publicacao_em
    ).toBeTruthy();

    const perfil = await request(app)
      .get(
        `/negocios/${negocio.body.negocio.slug}`
      );

    expect(perfil.statusCode).toBe(200);
    expect(perfil.body.negocio.id).toBe(
      negocio.body.negocio.id
    );
  });

  test("CA-NEG-05: despublicação manual prevalece sobre sincronizações até nova publicação explícita", async () => {
    const usuario =
      await criarUsuario("OcultacaoManual");

    const negocio =
      await criarNegocio(
        usuario,
        "Manual"
      );

    expect(negocio.statusCode).toBe(201);

    const primeiroServico =
      await criarPrimeiroServico(
        usuario
      );

    expect(
      primeiroServico.body.publicacao
        ?.publicado
    ).toBe(true);

    const ocultar = await request(app)
      .patch("/configuracoes/publicacao")
      .set(
        "Authorization",
        `Bearer ${token(usuario.id)}`
      )
      .send({ publicado: false });

    expect(ocultar.statusCode).toBe(200);
    expect(ocultar.body.publicacao).toMatchObject({
      publicado: false,
      pode_publicar: true,
      oculto_manual: true,
    });

    const atualizarPerfil = await request(app)
      .put("/configuracoes")
      .set(
        "Authorization",
        `Bearer ${token(usuario.id)}`
      )
      .send({
        descricao:
          "Descrição alterada depois da ocultação.",
      });

    expect(
      atualizarPerfil.statusCode
    ).toBe(200);
    expect(
      atualizarPerfil.body.publicacao
    ).toMatchObject({
      publicado: false,
      pode_publicar: true,
      oculto_manual: true,
    });

    const segundoServico =
      await criarPrimeiroServico(
        usuario,
        "Pedicure"
      );

    expect(
      segundoServico.statusCode
    ).toBe(201);
    expect(
      segundoServico.body.publicacao
        ?.publicado
    ).toBe(false);
    expect(
      segundoServico.body.publicacao
        ?.pode_publicar
    ).toBe(true);

    const aindaOculto = await db.query(
      `
        SELECT
          publicado,
          despublicado_manual_em
        FROM negocios
        WHERE id = $1
      `,
      [negocio.body.negocio.id]
    );

    expect(
      aindaOculto.rows[0].publicado
    ).toBe(false);
    expect(
      aindaOculto.rows[0]
        .despublicado_manual_em
    ).toBeTruthy();

    const republicar = await request(app)
      .patch("/configuracoes/publicacao")
      .set(
        "Authorization",
        `Bearer ${token(usuario.id)}`
      )
      .send({ publicado: true });

    expect(
      republicar.statusCode
    ).toBe(200);
    expect(
      republicar.body.publicacao
    ).toMatchObject({
      publicado: true,
      pode_publicar: true,
      oculto_manual: false,
    });

    const final = await db.query(
      `
        SELECT
          publicado,
          despublicado_manual_em
        FROM negocios
        WHERE id = $1
      `,
      [negocio.body.negocio.id]
    );

    expect(final.rows).toEqual([
      {
        publicado: true,
        despublicado_manual_em: null,
      },
    ]);
  });
});
