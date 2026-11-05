jest.mock("../src/db/db", () => ({ query: jest.fn() }));
const { Client } = require("pg");
const db = require("../src/db/db");
const repository = require("../src/repositories/perfilNegocioRepository");

describe("SQL do catálogo em PostgreSQL", () => {
  let client;
  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(
      "CREATE TEMP TABLE negocios (id bigint, nome text, slug text, foto_url text, descricao text, setor text, cidade text, estado text, bairro text, whatsapp text, localizacao_url text, latitude numeric, longitude numeric, publicado boolean, ativo boolean, areas text[]);" +
      "CREATE TEMP TABLE usuarios (id bigint, ativo boolean);" +
      "CREATE TEMP TABLE usuarios_negocios (usuario_id bigint, negocio_id bigint, ativo boolean, papel text);" +
      "CREATE TEMP TABLE agenda_horarios (profissional_id bigint, negocio_id bigint, trabalha boolean, hora_inicio time, hora_fim time, intervalo_inicio time, intervalo_fim time);" +
      "CREATE TEMP TABLE profissional_servicos (profissional_id bigint, negocio_id bigint, servico_id bigint);" +
      "CREATE TEMP TABLE servicos_negocio (id bigint, negocio_id bigint, nome text, descricao text, valor numeric, duracao_minutos int, categoria text, foto_url text, ativo boolean);" +
      "CREATE TEMP TABLE agendamentos (negocio_id bigint, avaliacao int);"
    );
    db.query.mockImplementation((sql, params) => client.query(sql, params));
  });
  afterAll(async () => { if (client) await client.end(); });
  beforeEach(async () => {
    await client.query("TRUNCATE negocios, usuarios, usuarios_negocios, agenda_horarios, profissional_servicos, servicos_negocio, agendamentos");
    await client.query(
      "INSERT INTO negocios (id,nome,slug,ativo,publicado) VALUES (1,'Studio','studio',true,true);" +
      "INSERT INTO usuarios VALUES (4,true);" +
      "INSERT INTO usuarios_negocios VALUES (4,1,true,'dono');" +
      "INSERT INTO servicos_negocio (id,negocio_id,nome,valor,duracao_minutos,categoria,ativo) VALUES (11,1,'Manicure',50,60,'unha',true),(12,1,'Alongamento',100,180,'unha',true);" +
      "INSERT INTO profissional_servicos VALUES (4,1,11),(4,1,12);" +
      "INSERT INTO agenda_horarios VALUES (4,1,true,'08:00','10:00',null,null)"
    );
  });
  test("calcula disponibilidade por serviço e mantém oferta sem disponibilidade visível", async () => {
    const [business] = await repository.listarNegociosPublicos();
    expect(business.agendamento_online_disponivel).toBe(true);
    expect(business.servicos.find(s => s.id === 11).agendamento_online_disponivel).toBe(true);
    expect(business.servicos.find(s => s.id === 12).agendamento_online_disponivel).toBe(false);
    await client.query("UPDATE agenda_horarios SET trabalha=false");
    const [closed] = await repository.listarNegociosPublicos();
    expect(closed.publicado).toBe(true);
    expect(closed.servicos).toHaveLength(2);
    expect(closed.agendamento_online_disponivel).toBe(false);
  });
  test.each([
    "DELETE FROM profissional_servicos",
    "UPDATE usuarios_negocios SET ativo=false",
    "UPDATE usuarios SET ativo=false",
    "UPDATE agenda_horarios SET negocio_id=2"
  ])("não oferece agendamento com contexto inelegível: %s", async (mutation) => {
    await client.query(mutation);
    const [business] = await repository.listarNegociosPublicos();
    expect(business.agendamento_online_disponivel).toBe(false);
  });
  test("a duração precisa caber inteira fora da pausa", async () => {
    await client.query("UPDATE agenda_horarios SET intervalo_inicio='08:30', intervalo_fim='09:30'");
    const [business] = await repository.listarNegociosPublicos();
    expect(business.agendamento_online_disponivel).toBe(false);
  });
  test.each(["%", "_", "\\"])("busca %s literalmente sem ampliar para todo o catálogo", async (term) => {
    await client.query("INSERT INTO negocios (id,nome,slug,ativo,publicado) VALUES (2,$1,'literal',true,true)", ["Studio " + term]);
    const result = await repository.listarNegociosPublicos({ busca: term });
    expect(result.map(item => item.id)).toEqual(["2"]);
  });
});
