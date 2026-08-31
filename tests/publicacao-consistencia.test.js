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

  test("salvar perfil sincroniza a publicação pela elegibilidade atual", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ slug: "studio" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          publicado: false,
          publicacao_exige_agenda: true,
          agenda_configurada: false
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          publicado: false,
          pode_publicar: false
        }]
      });

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

    const sqlAtualizacao = mockQuery.mock.calls[3][0];
    const sqlPublicacao = mockQuery.mock.calls[4][0];

    expect(sqlAtualizacao).not.toMatch(/publicado\s*=/i);
    const sqlCompacto =
      compactarSql(sqlAtualizacao);

    expect(sqlCompacto).toContain(
      "AREAS=COALESCE($15::TEXT[],ARRAY[]::TEXT[])"
    );
    expect(sqlPublicacao).toMatch(
      /UPDATE negocios[\s\S]*publicado\s*=\s*e\.pode_publicar/i
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

  test("pedido manual de publicação também passa pela elegibilidade central", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 11,
        publicado: false,
        pode_publicar: false
      }]
    });

    const resultado =
      await configuracoesRepository
        .atualizarPublicacao(
          11,
          true
        );
    const [sql, params] =
      mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /WITH elegibilidade[\s\S]*UPDATE negocios[\s\S]*publicado\s*=\s*e\.pode_publicar/i
    );
    expect(sql).not.toMatch(
      /SET\s+publicado\s*=\s*\$1/i
    );
    expect(params).toEqual([11, false]);
    expect(resultado.publicado).toBe(false);
  });

  test("confirmação da agenda preserva a publicação dos negócios legados", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 11,
        publicado: false,
        pode_publicar: false
      }]
    });

    await servicosRepository
      .sincronizarPublicacaoAutomatica(
        11,
        undefined,
        {
          preservarPublicacaoLegada: true
        }
      );
    const [sql, params] =
      mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /\$2::BOOLEAN\s*=\s*TRUE[\s\S]*publicacao_exige_agenda\s+IS\s+NOT\s+TRUE[\s\S]*THEN n\.publicado/i
    );
    expect(params).toEqual([11, true]);
  });

  test("novos negócios exigem agenda e todos os dados obrigatórios sem exigir descrição", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 11,
        publicado: true,
        pode_publicar: true
      }]
    });

    const resultado = await servicosRepository
      .sincronizarPublicacaoAutomatica(11);
    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/UPDATE negocios[\s\S]*publicado\s*=\s*e\.pode_publicar/i);
    expect(sql).toMatch(/EXISTS[\s\S]*servicos_negocio[\s\S]*s\.ativo\s*=\s*TRUE/i);
    expect(sql).not.toMatch(/n\.descricao/i);
    expect(sql).toMatch(/n\.publicacao_exige_agenda\s+IS\s+NOT\s+TRUE/i);
    expect(sql).toMatch(/n\.bairro/i);
    expect(sql).toMatch(/n\.endereco/i);
    expect(sql).toMatch(/n\.numero/i);
    expect(sql).toMatch(/n\.cep/i);
    expect(sql).toMatch(/n\.localizacao_url/i);
    expect(sql).toMatch(/agenda_configuracoes[\s\S]*configurado_em\s+IS\s+NOT\s+NULL/i);
    expect(params).toEqual([11, false]);
    expect(resultado).toEqual({
      id: 11,
      publicado: true,
      pode_publicar: true
    });
  });
});
