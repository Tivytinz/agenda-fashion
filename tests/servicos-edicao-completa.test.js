jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/servicosRepository");
jest.mock("../src/utils/uploadCloudinary", () => jest.fn());
jest.mock("../src/services/planoService", () => ({
  buscarUsoPlano: jest.fn(),
  criarErroLimite: jest.fn((mensagem, codigo, uso) => {
    const erro = new Error(mensagem);
    erro.status = 409;
    erro.statusCode = 409;
    erro.codigo = codigo;
    erro.uso = uso;
    return erro;
  }),
}));

const db = require("../src/db/db");
const servicosRepository = require("../src/repositories/servicosRepository");
const servicosService = require("../src/services/servicosService");

describe("Edição completa de serviços", () => {
  const client = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    db.executarTransacao.mockImplementation(async (callback) => callback(client));
    servicosRepository.buscarNegocioDono.mockResolvedValue({ negocio_id: 7 });
  });

  test("salva descrição e estado ativo", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 12,
      ativo: true,
    });
    servicosRepository.editarServico.mockResolvedValue({
      id: 12,
      nome: "Manicure premium",
      descricao: "Esmaltação e cuidado completo.",
      ativo: true,
    });

    const resultado = await servicosService.editarServico({
      usuarioId: 1,
      id: 12,
      nome: "Manicure premium",
      descricao: "  Esmaltação e cuidado completo.  ",
      valor: 70,
      duracaoMinutos: 60,
      ativo: true,
    });

    expect(servicosRepository.editarServico).toHaveBeenCalledWith(
      expect.objectContaining({
        descricao: "Esmaltação e cuidado completo.",
        ativo: true,
      }),
      client
    );
    expect(resultado.servico.id).toBe(12);
  });

  test("confere o limite antes de reativar", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 12,
      ativo: false,
    });
    servicosRepository.buscarPlanoDoNegocio.mockResolvedValue({
      nome: "Grátis",
      limite_servicos: 2,
    });
    servicosRepository.contarServicosAtivos.mockResolvedValue(2);

    await expect(servicosService.editarServico({
      usuarioId: 1,
      id: 12,
      nome: "Manicure",
      descricao: "",
      valor: 50,
      duracaoMinutos: 60,
      ativo: true,
    })).rejects.toMatchObject({
      statusCode: 409,
      codigo: "LIMITE_SERVICOS",
    });

    expect(servicosRepository.editarServico).not.toHaveBeenCalled();
  });

  test.each([
    ["NaN", "NaN", 60, "Valor do serviço inválido."],
    ["negativo", -1, 60, "Valor do serviço inválido."],
    ["duração zero", 50, 0, "A duração deve ser um número inteiro entre 5 e 1440 minutos."],
    ["duração fracionada", 50, 30.5, "A duração deve ser um número inteiro entre 5 e 1440 minutos."],
    ["duração excessiva", 50, 1441, "A duração deve ser um número inteiro entre 5 e 1440 minutos."]
  ])(
    "rejeita %s antes de abrir a transação",
    async (titulo, valor, duracaoMinutos, mensagem) => {
      await expect(
        servicosService.criarServico({
          usuarioId: 1,
          nome: "Manicure",
          valor,
          duracaoMinutos
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: mensagem
      });

      expect(db.executarTransacao).not.toHaveBeenCalled();
      expect(servicosRepository.criarServico).not.toHaveBeenCalled();
    }
  );

  test("lista a galeria somente para serviço do dono autenticado", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 12,
      negocio_id: 7,
    });
    servicosRepository.listarFotosServico.mockResolvedValue([
      { id: 2, foto_url: "https://imagem.test/foto.jpg" },
    ]);

    const resultado = await servicosService.listarFotosServico({
      usuarioId: 1,
      id: 12,
    });

    expect(servicosRepository.buscarServicoDoNegocio)
      .toHaveBeenCalledWith(12, 7);
    expect(resultado.fotos).toHaveLength(1);
  });
});
