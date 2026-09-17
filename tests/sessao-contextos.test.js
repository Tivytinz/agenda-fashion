jest.mock("../src/repositories/sessaoRepository", () => ({
  buscarUsuarioPorId: jest.fn(),
  buscarVinculosAtivosPorUsuarioId: jest.fn(),
  buscarAdministradorAtivoPorUsuarioId: jest.fn(),
}));

const sessaoRepository = require("../src/repositories/sessaoRepository");
const sessaoService = require("../src/services/sessaoService");

function usuarioAtivo() {
  return {
    id: 7,
    nome: "Pessoa Multi Contexto",
    email: "multi@example.com",
    whatsapp: "62999999999",
    foto_url: null,
    aceita_notificacoes_whatsapp: false,
    ativo: true,
    email_verificado_em: null,
    ultimo_login_em: null,
    senha_alterada_em: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

function vinculo({ negocioId, papel, nome }) {
  return {
    vinculo_id: negocioId + 100,
    papel,
    vinculado_em: new Date("2026-01-01T00:00:00Z"),
    negocio_id: negocioId,
    negocio_nome: nome,
    negocio_slug: `negocio-${negocioId}`,
    negocio_descricao: null,
    negocio_setor: "unhas",
    negocio_whatsapp: "62999999999",
    negocio_foto_url: null,
    negocio_cidade: "Goiânia",
    negocio_estado: "GO",
    negocio_bairro: "Centro",
    negocio_endereco: "Rua Teste",
    negocio_numero: "1",
    negocio_complemento: null,
    negocio_cep: "74000000",
    negocio_localizacao_url: null,
    negocio_latitude: null,
    negocio_longitude: null,
    negocio_fuso_horario: "America/Sao_Paulo",
    negocio_publicado: true,
    negocio_created_at: new Date("2026-01-01T00:00:00Z"),
    negocio_updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("sessão com múltiplos contextos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessaoRepository.buscarUsuarioPorId.mockResolvedValue(usuarioAtivo());
    sessaoRepository.buscarAdministradorAtivoPorUsuarioId.mockResolvedValue(null);
  });

  test("mantém negócio principal por compatibilidade e expõe todos os vínculos", async () => {
    sessaoRepository.buscarVinculosAtivosPorUsuarioId.mockResolvedValue([
      vinculo({ negocioId: 10, papel: "dono", nome: "Negócio próprio" }),
      vinculo({ negocioId: 20, papel: "profissional", nome: "Studio" }),
    ]);

    const resultado = await sessaoService.obterMinhaSessao(7);

    expect(resultado.temNegocio).toBe(true);
    expect(resultado.negocio).toMatchObject({
      id: 10,
      papel: "dono",
    });
    expect(resultado.vinculos).toEqual([
      expect.objectContaining({ id: 10, papel: "dono" }),
      expect.objectContaining({ id: 20, papel: "profissional" }),
    ]);
  });
});
