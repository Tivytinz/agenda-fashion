jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/profissionaisRepository");

const db = require("../src/db/db");
const profissionaisRepository = require(
  "../src/repositories/profissionaisRepository"
);
const profissionaisService = require(
  "../src/services/profissionaisService"
);

describe("Limite de profissionais", () => {
  const client = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    profissionaisRepository.buscarNegocioDono.mockResolvedValue({
      negocio_id: 7,
    });

    profissionaisRepository.buscarProfissionalPorEmailWhatsapp.mockResolvedValue({
      id: 20,
      nome: "Profissional Teste",
    });

    profissionaisRepository.bloquearCadastroProfissional.mockResolvedValue();
    profissionaisRepository.verificarVinculo.mockResolvedValue(null);
  });

  test("plano Grátis não permite adicionar um segundo profissional", async () => {
    profissionaisRepository.buscarPlanoDoNegocio.mockResolvedValue({
      nome: "Grátis",
      limite_profissionais: 1,
    });

    profissionaisRepository.contarProfissionaisAtivos.mockResolvedValue(1);

    await expect(
      profissionaisService.vincularProfissional({
        usuarioDonoId: 1,
        emailOuWhatsapp: "profissional@teste.com",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      codigo: "LIMITE_PROFISSIONAIS",
    });

    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("plano Salão permite até cinco profissionais", async () => {
    profissionaisRepository.buscarPlanoDoNegocio.mockResolvedValue({
      nome: "Salão",
      limite_profissionais: 5,
    });

    profissionaisRepository.contarProfissionaisAtivos.mockResolvedValue(4);
    profissionaisRepository.criarVinculo.mockResolvedValue();

    const resultado = await profissionaisService.vincularProfissional({
      usuarioDonoId: 1,
      emailOuWhatsapp: "profissional@teste.com",
    });

    expect(resultado.profissional.id).toBe(20);
    expect(profissionaisRepository.criarVinculo).toHaveBeenCalledWith(
      20,
      7,
      client
    );
  });
});
