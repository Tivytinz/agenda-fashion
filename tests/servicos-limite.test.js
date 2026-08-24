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
     * O limite deve vir do plano efetivamente liberado por
     * buscarUsoPlano, e não apenas do plano selecionado no negócio.
     */
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_servicos: 2,
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
    "bloqueia o terceiro serviço usando o plano efetivo Grátis",
    async () => {
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
        uso: {
          plano_nome: "Grátis",
          utilizados: 2,
          limite: 2,
          acima_do_limite: 0,
        },
      });

      expect(
        planoService.buscarUsoPlano
      ).toHaveBeenCalledWith(
        7,
        client
      );

      expect(
        servicosRepository.buscarPlanoDoNegocio
      ).not.toHaveBeenCalled();

      expect(
        servicosRepository.criarServico
      ).not.toHaveBeenCalled();
    }
  );

  test(
    "informa quando o negócio já está acima do limite efetivo",
    async () => {
      servicosRepository
        .contarServicosAtivos
        .mockResolvedValue(3);

      await expect(
        servicosService.criarServico({
          usuarioId: 1,
          nome: "Pedicure",
          valor: 45,
          duracaoMinutos: 50,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        codigo: "LIMITE_SERVICOS",
        uso: {
          plano_nome: "Grátis",
          utilizados: 3,
          limite: 2,
          acima_do_limite: 1,
        },
      });

      expect(
        servicosRepository.criarServico
      ).not.toHaveBeenCalled();
    }
  );

  test(
    "permite editar serviço que já estava ativo mesmo acima do limite",
    async () => {
      servicosRepository
        .buscarServicoDoNegocio
        .mockResolvedValue({
          id: 9,
          ativo: true,
          categoria: "unha",
        });

      servicosRepository
        .editarServico
        .mockResolvedValue({
          id: 9,
          nome: "Manicure premium",
          ativo: true,
        });

      servicosRepository
        .adicionarEspecialidadeNegocio
        .mockResolvedValue();

      servicosRepository
        .sincronizarPublicacaoAutomatica
        .mockResolvedValue({
          id: 7,
          publicado: true,
        });

      const resultado = await servicosService.editarServico({
        usuarioId: 1,
        id: 9,
        nome: "Manicure premium",
        valor: 60,
        duracaoMinutos: 60,
        categoria: "unha",
        ativo: true,
      });

      expect(resultado.servico).toMatchObject({
        id: 9,
        ativo: true,
      });
      expect(planoService.buscarUsoPlano).not.toHaveBeenCalled();
      expect(servicosRepository.editarServico).toHaveBeenCalled();
    }
  );

  test(
    "plano Salão permite serviços ilimitados",
    async () => {
      planoService.buscarUsoPlano.mockResolvedValue({
        negocio_id: 7,
        plano_nome: "Salão",
        limite_servicos: null,
        servicos_utilizados: 200,
      });

      servicosRepository
        .contarServicosAtivos
        .mockResolvedValue(200);

      servicosRepository
        .criarServico
        .mockResolvedValue({
          id: 10,
        });
      servicosRepository
        .sincronizarPublicacaoAutomatica
        .mockResolvedValue({
          id: 7,
          publicado: true,
        });

      const resultado =
        await servicosService.criarServico({
          usuarioId: 1,
          nome: "Coloração",
          valor: 150,
          duracaoMinutos: 120,
          categoria: "cabelo",
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
      expect(resultado.publicacao).toEqual({
        id: 7,
        publicado: true,
      });

      expect(
        servicosRepository
          .adicionarEspecialidadeNegocio
      ).toHaveBeenCalledWith(
        7,
        "Cabelos",
        client
      );
      expect(
        servicosRepository
          .sincronizarPublicacaoAutomatica
      ).toHaveBeenCalledWith(7, client);
    }
  );
});
