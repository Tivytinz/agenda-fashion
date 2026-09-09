jest.mock(
  "../src/repositories/negocioRepository",
  () => ({
    buscarNegocioDoDono: jest.fn(),
    buscarNegocioPorSlug: jest.fn(),
    criarNegocioComDono: jest.fn(),
  })
);

const negocioRepository = require(
  "../src/repositories/negocioRepository"
);
const negocioService = require(
  "../src/services/negocioService"
);

describe("Validação de UF na criação do negócio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    negocioRepository.buscarNegocioDoDono.mockResolvedValue(null);
  });

  test("rejeita uma sigla de duas letras que não é UF brasileira", async () => {
    await expect(
      negocioService.criar({
        usuarioId: 1,
        nome: "Studio Teste",
        especialidades: ["Unhas"],
        whatsapp: "62999999999",
        cidade: "Goiânia",
        estado: "ZZ",
        bairro: "Centro",
        endereco: "Rua Teste",
        numero: "10",
        cep: "74000000",
        localizacao_url: "https://maps.google.com/?q=teste",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Selecione um estado válido.",
    });

    expect(
      negocioRepository.buscarNegocioPorSlug
    ).not.toHaveBeenCalled();
    expect(
      negocioRepository.criarNegocioComDono
    ).not.toHaveBeenCalled();
  });
});
