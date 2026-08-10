const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery,
  executarTransacao: (callback) => callback({
    query: mockQuery
  })
}));

const configuracoesRepository = require(
  "../src/repositories/configuracoesRepository"
);
const servicosRepository = require(
  "../src/repositories/servicosRepository"
);


function compactarSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

describe("consistência da publicação do negócio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("salvar perfil incompleto retira negócio publicado", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ slug: "studio" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await configuracoesRepository.atualizarNegocio(11, {
      nome: "Studio",
      slug: "studio",
      foto_url: null,
      descricao: null,
      setor: "Unhas",
      cidade: "Goiânia",
      estado: "GO",
      bairro: "Centro",
      endereco: "Rua das Flores",
      numero: "10",
      complemento: "",
      cep: "74000123",
      localizacao_url: null,
      whatsapp_negocio: "62999999999",
      areas: []
    });

    const sql = mockQuery.mock.calls.at(-1)[0];

    expect(sql).toMatch(
      /publicado\s*=\s*CASE[\s\S]*negocios\.publicado\s*=\s*TRUE/i
    );
    const sqlCompacto =
      compactarSql(sql);

    for (
      const parametro
      of [4, 5, 6, 7, 14]
    ) {
      expect(
        sqlCompacto
      ).toContain(
        `NULLIF(BTRIM(COALESCE($${parametro}::TEXT,''::TEXT)),'')ISNOTNULL`
      );
    }

    expect(sqlCompacto).toContain(
      "AREAS=COALESCE($15::TEXT[],ARRAY[]::TEXT[])"
    );
    expect(sql).toMatch(
      /EXISTS[\s\S]*servicos_negocio[\s\S]*s\.ativo\s*=\s*TRUE/i
    );
  });

  test("sem serviço ativo despublica o negócio", async () => {
    await servicosRepository.despublicarSemServicoAtivo(11);

    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /UPDATE negocios[\s\S]*publicado\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /NOT EXISTS[\s\S]*servicos_negocio[\s\S]*s\.ativo\s*=\s*TRUE/i
    );
    expect(params).toEqual([11]);
  });
});
