jest.setTimeout(30000);

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const db = require("../src/db/db");

function gerarSufixoUnico() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

describe("Fluxo de profissionais com banco real", () => {
  const usuariosCriados = [];
  const negociosCriados = [];
  const agendamentosCriados = [];
  const sufixo = gerarSufixoUnico();

  let donoA;
  let donoB;
  let profissionalVinculado;
  let profissionalDisponivel;
  let negocioA;
  let negocioB;
  let tokenDonoA;
  let tokenDonoB;
  let tokenProfissional;
  let tokenProfissionalDisponivel;
  let planoEquipeId;

  async function criarUsuario(nome, marcador, indice) {
    const finalWhatsapp = `${String(Date.now()).slice(-7)}${indice}`;
    const resultado = await db.query(
      `
      INSERT INTO usuarios (nome, email, senha, whatsapp)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, email, whatsapp
      `,
      [nome, `${marcador}.${sufixo}@teste.local`, "hash-de-teste", `629${finalWhatsapp}`]
    );
    const usuario = resultado.rows[0];
    usuariosCriados.push(usuario.id);
    return usuario;
  }

  async function criarNegocio(nome, marcador, planoId) {
    const resultado = await db.query(
      `
      INSERT INTO negocios (nome, slug, plano_id)
      VALUES ($1, $2, $3)
      RETURNING id, nome, slug
      `,
      [nome, `teste-profissionais-${marcador}-${sufixo}`, planoId]
    );
    const negocio = resultado.rows[0];
    negociosCriados.push(negocio.id);
    return negocio;
  }

  function gerarToken(usuarioId) {
    return jwt.sign({ id: usuarioId }, process.env.JWT_SECRET, { expiresIn: "10m" });
  }

  beforeAll(async () => {
    const plano = await db.query(
      `
      INSERT INTO planos (
        nome, slug, valor, capacidade_agendamentos,
        limite_profissionais, limite_servicos, destaque, ativo
      )
      VALUES ($1, $2, 0, 100, 5, 10, FALSE, TRUE)
      RETURNING id
      `,
      ["Plano Teste Equipe", `teste-equipe-${sufixo}`]
    );

    planoEquipeId = plano.rows[0]?.id;
    expect(planoEquipeId).toBeTruthy();

    donoA = await criarUsuario("Dona Integração A", "dona-a", 1);
    donoB = await criarUsuario("Dona Integração B", "dona-b", 2);
    profissionalVinculado = await criarUsuario("Profissional Vinculada", "vinculada", 3);
    profissionalDisponivel = await criarUsuario("Profissional Disponível", "disponivel", 4);

    negocioA = await criarNegocio("Negócio Integração A", "a", plano.rows[0].id);
    negocioB = await criarNegocio("Negócio Integração B", "b", plano.rows[0].id);

    await db.query(
      `
      INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
      VALUES
        ($1, $2, 'dono'),
        ($3, $4, 'dono'),
        ($5, $2, 'profissional')
      `,
      [donoA.id, negocioA.id, donoB.id, negocioB.id, profissionalVinculado.id]
    );

    tokenDonoA = gerarToken(donoA.id);
    tokenDonoB = gerarToken(donoB.id);
    tokenProfissional = gerarToken(profissionalVinculado.id);
    tokenProfissionalDisponivel = gerarToken(profissionalDisponivel.id);
  });

  afterAll(async () => {
    try {
      if (agendamentosCriados.length > 0) {
        await db.query("DELETE FROM agendamentos WHERE id = ANY($1::BIGINT[])", [agendamentosCriados]);
      }
      if (negociosCriados.length > 0) {
        await db.query("DELETE FROM negocios WHERE id = ANY($1::BIGINT[])", [negociosCriados]);
      }
      if (planoEquipeId) {
        await db.query("DELETE FROM planos WHERE id = $1", [planoEquipeId]);
      }
      if (usuariosCriados.length > 0) {
        await db.query("DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])", [usuariosCriados]);
      }
    } finally {
      await db.end();
    }
  });

  test("dona cria convite sem vínculo e somente a profissional convidada efetiva o aceite", async () => {
    const criada = await request(app)
      .post("/profissionais/vincular")
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({ emailOuWhatsapp: profissionalDisponivel.email.toUpperCase() });

    expect(criada.statusCode).toBe(201);
    expect(criada.body.convite).toMatchObject({
      status: "pendente",
      profissional: {
        id: profissionalDisponivel.id,
        nome: profissionalDisponivel.nome,
      },
    });
    expect(criada.body.convite.profissional).not.toHaveProperty("email");
    expect(criada.body.convite.profissional).not.toHaveProperty("whatsapp");

    const antesDoAceite = await db.query(
      "SELECT id FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2",
      [profissionalDisponivel.id, negocioA.id]
    );
    expect(antesDoAceite.rowCount).toBe(0);

    const recebidos = await request(app)
      .get("/profissionais/convites/recebidos")
      .set("Authorization", `Bearer ${tokenProfissionalDisponivel}`);

    expect(recebidos.statusCode).toBe(200);
    expect(recebidos.body.convites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: criada.body.convite.id,
        negocio_id: negocioA.id,
        negocio_nome: negocioA.nome,
        status: "pendente",
      }),
    ]));

    const aceiteIndevido = await request(app)
      .post(`/profissionais/convites/${criada.body.convite.id}/aceitar`)
      .set("Authorization", `Bearer ${tokenDonoB}`);
    expect(aceiteIndevido.statusCode).toBe(403);

    const aceita = await request(app)
      .post(`/profissionais/convites/${criada.body.convite.id}/aceitar`)
      .set("Authorization", `Bearer ${tokenProfissionalDisponivel}`);

    expect(aceita.statusCode).toBe(200);
    expect(aceita.body.convite.status).toBe("aceito");

    const vinculo = await db.query(
      `SELECT papel, ativo FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2`,
      [profissionalDisponivel.id, negocioA.id]
    );
    expect(vinculo.rows).toEqual([{ papel: "profissional", ativo: true }]);
  });

  test("CA-EQP-01: conta inexistente não gera convite nem vínculo", async () => {
    const antes = await db.query(
      "SELECT COUNT(*)::int AS total FROM convites_profissionais WHERE negocio_id = $1",
      [negocioA.id]
    );

    const resposta = await request(app)
      .post("/profissionais/convites")
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({ emailOuWhatsapp: `inexistente.${sufixo}@teste.local` });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.body.erro).toContain("criar uma conta primeiro");

    const depois = await db.query(
      "SELECT COUNT(*)::int AS total FROM convites_profissionais WHERE negocio_id = $1",
      [negocioA.id]
    );
    expect(depois.rows[0].total).toBe(antes.rows[0].total);
  });

  test("dona edita apenas o perfil do vínculo com o negócio", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({ nome: "  Profissional Atualizada  ", whatsapp: "(62) 99999-1234" });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.profissional).toMatchObject({
      id: profissionalVinculado.id,
      nome: "Profissional Atualizada",
      whatsapp: "62999991234"
    });

    const contaGlobal = await db.query(
      "SELECT nome, whatsapp FROM usuarios WHERE id = $1",
      [profissionalVinculado.id]
    );
    expect(contaGlobal.rows[0]).toMatchObject({
      nome: profissionalVinculado.nome,
      whatsapp: profissionalVinculado.whatsapp
    });
  });

  test("CA-NFR-01: dona de outro negócio não edita o profissional", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoB}`)
      .send({ nome: "Alteração indevida", whatsapp: "62999991234" });
    expect(resposta.statusCode).toBe(404);
  });

  test("profissional sem papel de dona não convida pessoas", async () => {
    const resposta = await request(app)
      .post("/profissionais/convites")
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({ emailOuWhatsapp: profissionalDisponivel.email });
    expect(resposta.statusCode).toBe(403);
  });

  test("edição rejeita WhatsApp inválido antes de consultar o banco", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({ nome: "Profissional Atualizada", whatsapp: "123" });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.body.erro).toBe("WhatsApp do profissional inválido.");
  });

  test("CA-EQP-05: não remove profissional com reserva futura confirmada", async () => {
    const servico = await db.query(
      `
      INSERT INTO servicos_negocio (negocio_id, nome, valor, duracao_minutos, categoria, ativo)
      VALUES ($1, $2, 50, 60, 'unha', TRUE)
      RETURNING id
      `,
      [negocioA.id, `Serviço compromisso ${sufixo}`]
    );

    const agendamento = await db.query(
      `
      INSERT INTO agendamentos (
        negocio_id, servico_id, profissional_id, cliente_id,
        data, horario, status, valor_servico, duracao_minutos
      )
      VALUES (
        $1, $2, $3, $4,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 2,
        '10:00', 'confirmado', 50, 60
      )
      RETURNING id
      `,
      [negocioA.id, servico.rows[0].id, profissionalDisponivel.id, donoB.id]
    );

    agendamentosCriados.push(agendamento.rows[0].id);

    const bloqueada = await request(app)
      .delete(`/profissionais/${profissionalDisponivel.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);
    expect(bloqueada.statusCode).toBe(409);
    expect(bloqueada.body.erro).toContain("1 agendamento futuro ativo");

    const vinculoPreservado = await db.query(
      `SELECT ativo FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2`,
      [profissionalDisponivel.id, negocioA.id]
    );
    expect(vinculoPreservado.rows).toEqual([{ ativo: true }]);

    await db.query(
      "UPDATE agendamentos SET status = 'cancelado', cancelado_em = NOW() WHERE id = $1",
      [agendamento.rows[0].id]
    );

    const liberada = await request(app)
      .delete(`/profissionais/${profissionalDisponivel.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);
    expect(liberada.statusCode).toBe(200);
  });

  test("CA-EQP-04: proprietária não pode remover o próprio vínculo ativo", async () => {
    const resposta = await request(app)
      .delete(`/profissionais/${donoA.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);

    expect(resposta.statusCode).toBe(403);
    expect(resposta.body.erro).toMatch(/dono não pode remover a si mesmo/i);

    const vinculo = await db.query(
      `SELECT papel, ativo FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2`,
      [donoA.id, negocioA.id]
    );
    expect(vinculo.rows).toEqual([{ papel: "dono", ativo: true }]);
  });

  test("somente a dona do negócio remove o vínculo", async () => {
    const tentativaExterna = await request(app)
      .delete(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoB}`);
    expect(tentativaExterna.statusCode).toBe(404);

    const resposta = await request(app)
      .delete(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);
    expect(resposta.statusCode).toBe(200);
  });

  test("CA-EQP-02: aceite sem vaga aguarda capacidade e dona ativa depois", async () => {
    const convidada = await criarUsuario(
      "Convidada Sem Vaga",
      "sem-vaga",
      6
    );
    const tokenConvidada = gerarToken(convidada.id);

    await db.query(
      "UPDATE planos SET limite_profissionais = 1 WHERE id = $1",
      [planoEquipeId]
    );

    try {
      const convite = await request(app)
        .post("/profissionais/convites")
        .set("Authorization", `Bearer ${tokenDonoB}`)
        .send({ emailOuWhatsapp: convidada.email });

      expect(convite.statusCode).toBe(201);

      const aceite = await request(app)
        .post(`/profissionais/convites/${convite.body.convite.id}/aceitar`)
        .set("Authorization", `Bearer ${tokenConvidada}`);

      expect(aceite.statusCode).toBe(200);
      expect(aceite.body).toMatchObject({
        convite: { status: "aceito" },
        vinculo: {
          ativo: false,
          estado: "aguardando_vaga",
        },
      });

      const aguardando = await db.query(
        `
        SELECT papel, ativo, motivo_inatividade
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND negocio_id = $2
        `,
        [convidada.id, negocioB.id]
      );

      expect(aguardando.rows).toEqual([{
        papel: "profissional",
        ativo: false,
        motivo_inatividade: "aguardando_vaga_plano",
      }]);

      const convitesDepoisDoAceite = await request(app)
        .get("/profissionais/convites/recebidos")
        .set("Authorization", `Bearer ${tokenConvidada}`);

      expect(convitesDepoisDoAceite.statusCode).toBe(200);
      expect(convitesDepoisDoAceite.body.convites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: convite.body.convite.id,
            status: "aceito",
            estado: "aguardando_vaga",
          }),
        ])
      );

      const sessaoAguardando = await request(app)
        .get("/minha-sessao")
        .set("Authorization", `Bearer ${tokenConvidada}`);

      expect(sessaoAguardando.statusCode).toBe(200);
      expect(sessaoAguardando.body.temNegocio).toBe(false);
      expect(sessaoAguardando.body.vinculos).toEqual([]);

      const equipe = await request(app)
        .get("/profissionais")
        .set("Authorization", `Bearer ${tokenDonoB}`);

      expect(equipe.statusCode).toBe(200);
      expect(equipe.body.profissionais).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: convidada.id,
            ativo: false,
            motivo_inatividade: "aguardando_vaga_plano",
            whatsapp: null,
          }),
        ])
      );

      const semCapacidade = await request(app)
        .post(`/profissionais/${convidada.id}/ativar`)
        .set("Authorization", `Bearer ${tokenDonoB}`);

      expect(semCapacidade.statusCode).toBe(409);
      expect(semCapacidade.body.erro).toMatch(/limite de 1 profissional/i);

      await db.query(
        "UPDATE planos SET limite_profissionais = 5 WHERE id = $1",
        [planoEquipeId]
      );

      const ativada = await request(app)
        .post(`/profissionais/${convidada.id}/ativar`)
        .set("Authorization", `Bearer ${tokenDonoB}`);

      expect(ativada.statusCode).toBe(200);
      expect(ativada.body).toMatchObject({
        profissional_id: convidada.id,
        ativo: true,
      });

      const vinculoAtivo = await db.query(
        `
        SELECT papel, ativo, motivo_inatividade
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND negocio_id = $2
        `,
        [convidada.id, negocioB.id]
      );

      expect(vinculoAtivo.rows).toEqual([{
        papel: "profissional",
        ativo: true,
        motivo_inatividade: null,
      }]);
    } finally {
      await db.query(
        "UPDATE planos SET limite_profissionais = 5 WHERE id = $1",
        [planoEquipeId]
      );
    }
  });

  test("CA-EQP-03: convite pendente não é aceito após arquivar o negócio", async () => {
    const convidada = await criarUsuario("Convidada Arquivada", "arquivada", 5);
    const convite = await request(app)
      .post("/profissionais/convites")
      .set("Authorization", `Bearer ${tokenDonoB}`)
      .send({ emailOuWhatsapp: convidada.email });

    expect(convite.statusCode).toBe(201);
    expect(convite.body.convite.status).toBe("pendente");

    await db.query("UPDATE negocios SET ativo = FALSE WHERE id = $1", [negocioB.id]);

    const aceite = await request(app)
      .post(`/profissionais/convites/${convite.body.convite.id}/aceitar`)
      .set("Authorization", `Bearer ${gerarToken(convidada.id)}`);

    expect(aceite.statusCode).toBe(409);

    const convitePersistido = await db.query(
      "SELECT status FROM convites_profissionais WHERE id = $1",
      [convite.body.convite.id]
    );
    expect(convitePersistido.rows).toEqual([{ status: "pendente" }]);

    const vinculo = await db.query(
      "SELECT id FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2",
      [convidada.id, negocioB.id]
    );
    expect(vinculo.rowCount).toBe(0);
  });
});
