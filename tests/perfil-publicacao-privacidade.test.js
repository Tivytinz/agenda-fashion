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
      categoria: "estetica",
      categoriaTermos: ["estética", "limpeza de pele"],
      limite: 12,
      offset: 24
    });

    const [sql, parametros] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/LIKE ALL\(\$1::text\[\]\)/i);
    expect(sql).toMatch(/LIKE ANY\(\$2::text\[\]\)/i);
    expect(sql).toMatch(
      /jsonb_agg[\s\S]*WHERE s\.negocio_id = n\.id[\s\S]*cardinality\(\$2::text\[\]\) = 0[\s\S]*s\.nome[\s\S]*LIKE ANY\(\$2::text\[\]\)/i
    );
    expect(sql).toMatch(/LIMIT \$4[\s\S]*OFFSET \$5/i);
    expect(sql).toMatch(/COUNT\(\*\) OVER\(\)/i);
    expect(sql).toMatch(/array_to_string[\s\S]*n\.areas/i);
    expect(sql).toMatch(/COALESCE\([\s\S]*n\.areas[\s\S]*AS areas/i);
    expect(parametros).toEqual([
      ["%cilios%"],
      ["%estetica%", "%limpeza de pele%"],
      "estetica",
      12,
      24
    ]);
  });

  test("categoria limita também os serviços devolvidos", async () => {
    await repository.listarNegociosPublicos({
      categoria: "unha",
      categoriaTermos: ["unha"]
    });

    const sql = mockQuery.mock.calls[0][0];
    const agregacaoServicos = sql.slice(
      sql.indexOf("jsonb_agg")
    );

    expect(agregacaoServicos).toMatch(/s\.categoria\s*=\s*\$3::text/i);
    expect(agregacaoServicos).toMatch(
      /s\.categoria IS NULL[\s\S]*s\.nome[\s\S]*s\.descricao[\s\S]*LIKE ANY\(\$2::text\[\]\)/i
    );
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

  test("perfil devolve categoria de cada serviço", async () => {
    await repository.buscarServicos(7);

    const sql = mockQuery.mock.calls[0][0];

    expect(sql).toMatch(/duracao_minutos,[\s\S]*categoria,[\s\S]*foto_url/i);
  });
});
