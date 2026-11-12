jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const { buscarJornada } = require("../src/repositories/adminAnalyticsV2Repository");

describe("resumo first-party do cadastro profissional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql) => ({
      rows: sql.includes("WITH visitas AS")
        ? [{
          visualizacoes: 8,
          sessoes_visita: 6,
          sessoes_inicio: 4,
          sessoes_envio: 3,
          sessoes_envio_email: 2,
          sessoes_envio_google: 2,
          sessoes_erro: 2,
          sessoes_erro_requisicao: 1,
          erros_validacao: 5,
          erros_requisicao: 2,
        }]
        : []
    }));
  });

  test("agrupa sessões de visitas profissionais e eventos da mesma visualização", async () => {
    const result = await buscarJornada("30");

    expect(db.query).toHaveBeenCalledTimes(5);
    const sql = db.query.mock.calls[4][0];
    expect(sql).toContain("v.page_key = 'professional_register'");
    expect(sql).toContain("e.visualizacao_id = v.id");
    expect(sql).toContain("COUNT(DISTINCT sessao_id)");
    expect(sql).toContain("e.origem = 'frontend'");
    expect(sql).toContain("e.occurred_at >=");
    expect(sql).toContain("professional_signup_request_error");
    expect(sql).toContain("e.propriedades->>'method' = 'email'");
    expect(sql).toContain("e.propriedades->>'method' = 'google'");
    expect(sql).toContain("COUNT(DISTINCT sessao_id) FILTER (WHERE erros_requisicao > 0)");
    expect(result.cadastroProfissional).toMatchObject({
      sessoes_visita: 6,
      sessoes_inicio: 4,
      sessoes_envio: 3,
      sessoes_envio_email: 2,
      sessoes_envio_google: 2,
      sessoes_erro: 2,
      sessoes_erro_requisicao: 1,
      erros_validacao: 5,
      erros_requisicao: 2
    });
  });

  test("não inventa conversões reais nem atribui ausência de eventos a abandono", async () => {
    const result = await buscarJornada("all");
    expect(result.cadastroProfissional).not.toHaveProperty("contas_criadas");
    expect(result.cadastroProfissional).not.toHaveProperty("abandonos");
    const sql = db.query.mock.calls[4][0];
    expect(sql).not.toContain("e.occurred_at >=");
  });
});
