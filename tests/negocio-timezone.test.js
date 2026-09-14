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

function dadosNegocio(
  fusoHorario
) {
  return {
    usuarioId: 7,
    nome: "Studio Aurora",
    especialidades: ["Unhas"],
    fuso_horario: fusoHorario,
  };
}

describe("fuso horário do negócio", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    negocioRepository
      .buscarNegocioDoDono
      .mockResolvedValue(null);

    negocioRepository
      .buscarNegocioPorSlug
      .mockResolvedValue(null);

    negocioRepository
      .criarNegocioComDono
      .mockImplementation(
        async ({ negocio }) => ({
          negocio: {
            id: 15,
            ...negocio,
          },
        })
      );
  });

  test("persiste um identificador IANA válido", async () => {
    const resultado =
      await negocioService.criar(
        dadosNegocio("America/Manaus")
      );

    expect(resultado.negocio)
      .toMatchObject({
        fuso_horario: "America/Manaus",
      });

    expect(
      negocioRepository.criarNegocioComDono
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        negocio: expect.objectContaining({
          fuso_horario: "America/Manaus",
        }),
      })
    );
  });

  test("usa São Paulo como fallback quando o campo não é informado", async () => {
    const resultado =
      await negocioService.criar(
        dadosNegocio(undefined)
      );

    expect(resultado.negocio)
      .toMatchObject({
        fuso_horario: "America/Sao_Paulo",
      });
  });

  test("rejeita fuso que não existe na base IANA", async () => {
    await expect(
      negocioService.criar(
        dadosNegocio("Brasil/Fuso-Inexistente")
      )
    ).rejects.toMatchObject({
      message: "Fuso horário inválido.",
      statusCode: 400,
    });

    expect(
      negocioRepository.criarNegocioComDono
    ).not.toHaveBeenCalled();
  });
});
