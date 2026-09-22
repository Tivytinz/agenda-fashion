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
      /despublicado_manual_em\s+IS\s+NOT\s+NULL[\s\S]*THEN FALSE/i
    );
    expect(sqlPublicacao).toMatch(
      /ELSE\s+e\.pode_publicar/i
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

  test("pedido manual de publicação limpa a ocultação e passa pela elegibilidade central", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 11 }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          publicado: true,
          pode_publicar: true,
          despublicado_manual_em: null
        }]
      });

    const resultado =
      await configuracoesRepository
        .atualizarPublicacao(
          11,
          true
        );

    const [sqlDesbloqueio, paramsDesbloqueio] =
      mockQuery.mock.calls[0];
    const [sqlPublicacao, paramsPublicacao] =
      mockQuery.mock.calls[1];

    expect(sqlDesbloqueio).toMatch(
      /despublicado_manual_em\s*=\s*NULL/i
    );
    expect(paramsDesbloqueio).toEqual([11]);
    expect(sqlPublicacao).toMatch(
      /WITH elegibilidade[\s\S]*UPDATE negocios/i
    );
    expect(sqlPublicacao).toMatch(
      /despublicado_manual_em\s+IS\s+NOT\s+NULL[\s\S]*THEN FALSE/i
    );
    expect(paramsPublicacao).toEqual([11, false]);
    expect(resultado).toMatchObject({
      publicado: true,
      pode_publicar: true,
      despublicado_manual_em: null
    });
  });

  test("CA-NEG-05: despublicação manual registra intenção durável", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 11,
        publicado: false,
        despublicado_manual_em: "2026-09-22T12:00:00.000Z"
      }]
    });

    const resultado =
      await configuracoesRepository
        .atualizarPublicacao(
          11,
          false
        );

    const [sql, params] =
      mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /publicado\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /despublicado_manual_em\s*=\s*NOW\(\)/i
    );
    expect(params).toEqual([11]);
    expect(resultado).toMatchObject({
      publicado: false,
      despublicado_manual_em: expect.any(String)
    });
  });

  test("a compatibilidade legada preserva uma publicação já existente", async () => {
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
      /\$2::BOOLEAN\s*=\s*TRUE[\s\S]*publicacao_exige_agenda\s+IS\s+NOT\s+TRUE[\s\S]*THEN TRUE/i
    );
    expect(params).toEqual([11, true]);
  });

  test("CA-NEG-04: novos negócios elegíveis publicam automaticamente sem descrição ou agenda", async () => {
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

    expect(sql).toMatch(
      /UPDATE negocios[\s\S]*despublicado_manual_em\s+IS\s+NOT\s+NULL[\s\S]*THEN FALSE[\s\S]*ELSE\s+e\.pode_publicar/i
    );
    expect(sql).toMatch(/EXISTS[\s\S]*servicos_negocio[\s\S]*s\.ativo\s*=\s*TRUE/i);
    expect(sql).not.toMatch(/n\.descricao/i);
    expect(sql).toMatch(/n\.publicacao_exige_agenda\s+IS\s+NOT\s+TRUE/i);
    expect(sql).toMatch(/n\.bairro/i);
    expect(sql).toMatch(/n\.endereco/i);
    expect(sql).toMatch(/n\.numero/i);
    expect(sql).toMatch(/n\.cep/i);
    expect(sql).toMatch(/n\.localizacao_url/i);
    expect(sql).not.toMatch(/agenda_configuracoes/i);
    expect(params).toEqual([11, false]);
    expect(resultado).toEqual({
      id: 11,
      publicado: true,
      pode_publicar: true
    });
  });
});
