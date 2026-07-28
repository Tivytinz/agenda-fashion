jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/servicosRepository");

jest.mock(
  "../src/utils/uploadCloudinary",
  () => jest.fn()
);

/*
 * O mock precisa ser declarado antes da importação de
 * servicosService, pois o service utiliza essas funções.
 */
jest.mock("../src/services/planoService", () => ({
  buscarUsoPlano: jest.fn(),

  criarErroLimite: jest.fn(
    (mensagem, codigo, uso = null) => {
      const erro = new Error(mensagem);

      erro.status = 409;
      erro.statusCode = 409;
      erro.codigo = codigo;
      erro.uso = uso;

      return erro;
    }
  ),
}));

const db = require("../src/db/db");

const servicosRepository = require(
  "../src/repositories/servicosRepository"
);

const planoService = require(
  "../src/services/planoService"
);

const servicosService = require(
  "../src/services/servicosService"
);

describe("Limite de serviços", () => {
  const client = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    /*
     * Impede que o teste unitário execute as consultas
     * reais usadas por buscarUsoPlano.
     */
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Plano de teste",
      servicos_utilizados: 2,
    });

    servicosRepository
      .buscarNegocioDono
      .mockResolvedValue({
        negocio_id: 7,
      });

    servicosRepository
      .bloquearCadastroServico
      .mockResolvedValue();
  });

  test(
    "bloqueia o terceiro serviço no plano Grátis",
    async () => {
      servicosRepository
        .buscarPlanoDoNegocio
        .mockResolvedValue({
          nome: "Grátis",
          limite_servicos: 2,
        });

      servicosRepository
        .contarServicosAtivos
        .mockResolvedValue(2);

      await expect(
        servicosService.criarServico({
          usuarioId: 1,
          nome: "Manicure",
          valor: 50,
          duracaoMinutos: 60,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        codigo: "LIMITE_SERVICOS",
      });

      expect(
        planoService.buscarUsoPlano
      ).toHaveBeenCalledWith(
        7,
        client
      );

      expect(
        servicosRepository.criarServico
      ).not.toHaveBeenCalled();
    }
  );

  test(
    "plano Salão permite serviços ilimitados",
    async () => {
      servicosRepository
        .buscarPlanoDoNegocio
        .mockResolvedValue({
          nome: "Salão",
          limite_servicos: null,
        });

      servicosRepository
        .contarServicosAtivos
        .mockResolvedValue(200);

      servicosRepository
        .criarServico
        .mockResolvedValue({
          id: 10,
        });

      const resultado =
        await servicosService.criarServico({
          usuarioId: 1,
          nome: "Coloração",
          valor: 150,
          duracaoMinutos: 120,
        });

      expect(
        planoService.buscarUsoPlano
      ).toHaveBeenCalledWith(
        7,
        client
      );

      expect(resultado.servico).toEqual({
        id: 10,
      });
    }
  );
});