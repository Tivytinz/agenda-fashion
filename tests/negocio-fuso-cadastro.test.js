const service = require("../src/services/negocioService");
const repo = require("../src/repositories/negocioRepository");
const ZONES = require("../src/config/businessTimeZones.json");

jest.mock("../src/repositories/negocioRepository", () => ({
  buscarNegocioDoDono: jest.fn().mockResolvedValue(null),
  buscarNegocioPorSlug: jest.fn().mockResolvedValue(null),
  criarNegocioComDono: jest.fn(async ({ negocio }) => ({ negocio: { id: 9, ...negocio } }))
}));

const payload = (estado, fuso_horario) => ({
  usuarioId: 7, nome: "Studio Novo", especialidades: ["Unhas"],
  estado, fuso_horario
});

describe("fuso horário seguro na criação", () => {
  beforeEach(() => jest.clearAllMocks());
  test.each([
    ["GO", "America/Sao_Paulo"],
    ["AC", "America/Rio_Branco"],
    ["MT", "America/Cuiaba"],
    ["RO", "America/Porto_Velho"]
  ])("deriva %s sem depender do fuso do aparelho", async (estado, expected) => {
    const result = await service.criar(payload(estado));
    expect(result.negocio.fuso_horario).toBe(expected);
  });
  test("solicita escolha quando estado possui mais de um fuso", async () => {
    await expect(service.criar(payload("AM"))).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.criarNegocioComDono).not.toHaveBeenCalled();
  });
  test("aceita fuso legítimo de região ambígua", async () => {
    expect((await service.criar(payload("AM", "America/Eirunepe"))).negocio.fuso_horario)
      .toBe("America/Eirunepe");
  });
  test("rejeita fuso válido de outro estado", async () => {
    await expect(service.criar(payload("GO", "America/Manaus")))
      .rejects.toMatchObject({ statusCode: 400 });
  });
  test("cobertura de todas as UFs e nomes IANA válidos", () => {
    expect(Object.keys(ZONES)).toHaveLength(27);
    for (const zones of Object.values(ZONES)) for (const zone of zones) {
      expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: zone.value })).not.toThrow();
    }
  });
});
