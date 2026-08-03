const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery
}));

const repository = require(
  "../src/repositories/perfilNegocioRepository"
);

describe("Publicação e privacidade do perfil público", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("catálogo e slug exigem negócio publicado", async () => {
    await repository.listarNegociosPublicos();
    await repository.buscarNegocioPorSlug("studio");

    const sqlCatalogo = mockQuery.mock.calls[0][0];
    const sqlPerfil = mockQuery.mock.calls[1][0];

    expect(sqlCatalogo).toMatch(
      /n\.ativo\s*=\s*TRUE[\s\S]*n\.publicado\s*=\s*TRUE/i
    );
    expect(sqlPerfil).toMatch(
      /n\.slug\s*=\s*\$1[\s\S]*n\.publicado\s*=\s*TRUE/i
    );
  });

  test("catálogo filtra e pagina no banco de dados", async () => {
    await repository.listarNegociosPublicos({
      busca: "Cílios",
      categoria: "estética",
      limite: 12,
      offset: 24
    });

    const [sql, parametros] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/LIKE ALL\(\$1::text\[\]\)/i);
    expect(sql).toMatch(/LIMIT \$2[\s\S]*OFFSET \$3/i);
    expect(sql).toMatch(/COUNT\(\*\) OVER\(\)/i);
    expect(parametros).toEqual([
      ["%cilios%", "%estetica%"],
      12,
      24
    ]);
  });

  test("perfil não seleciona identificadores internos", async () => {
    await repository.buscarNegocioPorSlug("studio");

    const sql = mockQuery.mock.calls[0][0];

    expect(sql).not.toContain("foto_public_id");
    expect(sql).not.toContain("dono_usuario_id");
    expect(sql).not.toContain("n.created_at");
    expect(sql).not.toContain("n.updated_at");
  });

  test("equipe pública não seleciona WhatsApp individual", async () => {
    await repository.buscarProfissionais(7);

    const sql = mockQuery.mock.calls[0][0];

    expect(sql).not.toMatch(/u\.whatsapp/i);
  });
});
