jest.mock("../src/repositories/planoRepository");
jest.mock("../src/repositories/assinaturaRepository");

const planoRepository = require(
  "../src/repositories/planoRepository"
);
const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const planoService = require(
  "../src/services/planoService"
);

function planoBasico() {
  return {
    negocio_id: 7,
    negocio_nome: "Studio Teste",
    plano_id: 1,
    plano_nome: "Grátis",
    plano_slug: "inicial",
    valor: "0.00",
    capacidade_agendamentos: 10,
    limite_profissionais: 1,
    limite_servicos: 2,
    destaque: false,
    utilizados: 1,
    profissionais_utilizados: 1,
    servicos_utilizados: 1,
  };
}

describe("fronteiras do módulo de planos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assinaturaRepository
      .expirarCancelamentoSeNecessario
      .mockResolvedValue();
  });

  test("lista planos por meio do repository", async () => {
    planoRepository.listarPlanosAtivos
      .mockResolvedValue([
        { id: 1, slug: "inicial" },
      ]);

    await expect(planoService.listarPlanos())
      .resolves.toEqual([
        { id: 1, slug: "inicial" },
      ]);
  });

  test("busca o plano somente pelo vínculo autenticado do dono", async () => {
    planoRepository
      .buscarNegocioDonoAtivoPorUsuario
      .mockResolvedValue({ negocio_id: 7 });
    planoRepository.buscarUsoPlano
      .mockResolvedValue(planoBasico());

    const resultado = await planoService
      .buscarMeuPlano(21);

    expect(
      planoRepository.buscarNegocioDonoAtivoPorUsuario
    ).toHaveBeenCalledWith(21);
    expect(planoRepository.buscarUsoPlano)
      .toHaveBeenCalledWith(7, null, expect.anything());
    expect(resultado).toMatchObject({
      negocio_id: 7,
      plano_slug: "inicial",
    });
  });

  test("não aceita usuário sem vínculo de dono ativo", async () => {
    planoRepository
      .buscarNegocioDonoAtivoPorUsuario
      .mockResolvedValue(null);

    await expect(
      planoService.buscarMeuPlano(21)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Negócio não encontrado.",
    });

    expect(planoRepository.buscarUsoPlano)
      .not.toHaveBeenCalled();
  });
});
