const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery,
}));

const repository = require(
  "../src/repositories/adminSaasHealthRepository"
);

describe("consulta da saúde do SaaS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("separa descrição opcional dos dados essenciais e respeita autorização de contato", async () => {
    await repository.buscarResumo();

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/AS descricao_preenchida/i);
    expect(sql).toMatch(/AS perfil_basico_completo/i);
    expect(sql).toMatch(/AS sem_descricao/i);
    expect(sql).toMatch(/WHERE etapas_concluidas\s*<\s*5/i);
    expect(sql).not.toMatch(
      /etapas_concluidas\s*<\s*5[\s\S]*OR descricao_preenchida\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /whatsapp_marketing_consentido_em IS NOT NULL[\s\S]*whatsapp_marketing_cancelado_em IS NULL/i
    );
  });

  test("filtra sem descrição e prioriza quem está mais perto de concluir", async () => {
    await repository.listarPerfisIncompletos({
      pendencia: "descricao",
    });

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /WHERE descricao_preenchida\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /AND tem_negocio\s*=\s*TRUE AND descricao_preenchida\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /ORDER BY[\s\S]*\(etapas_concluidas\s*=\s*5\) ASC[\s\S]*etapas_concluidas DESC[\s\S]*ultima_atividade_em DESC/i
    );
  });

  test("mantém perfis completos fora da fila padrão", async () => {
    await repository.listarPerfisIncompletos({ pendencia: "todos" });

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/WHERE etapas_concluidas\s*<\s*5/i);
    expect(sql).not.toMatch(/WHERE descricao_preenchida\s*=\s*FALSE/i);
  });
});
