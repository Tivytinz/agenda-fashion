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
      categoria: "unha",
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
        categoria: "unha",
        ativo: true,
      }),
      client
    );
    expect(
      servicosRepository.sincronizarPublicacaoAutomatica
    ).toHaveBeenCalledWith(7, client);
    expect(
      servicosRepository.adicionarEspecialidadeNegocio
    ).toHaveBeenCalledWith(
      7,
      "Unhas",
      client
    );
    expect(resultado.servico.id).toBe(12);
  });

  test("salva a categoria explícita escolhida pela profissional", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 15,
      ativo: true,
      categoria: null,
    });
    servicosRepository.editarServico.mockResolvedValue({ id: 15, categoria: "sobrancelha" });

    await servicosService.editarServico({
      usuarioId: 1,
      id: 15,
      nome: "Design + Henna",
      descricao: "",
      valor: 45,
      duracaoMinutos: 40,
      categoria: "sobrancelha",
      ativo: true,
    });

    expect(servicosRepository.editarServico).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: "sobrancelha" }),
      client
    );
    expect(
      servicosRepository.adicionarEspecialidadeNegocio
    ).toHaveBeenCalledWith(
      7,
      "Sobrancelhas",
      client
    );
  });

  test("remove marcadores soltos no início do nome do serviço", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 18,
      ativo: true,
      categoria: "cilio",
    });
    servicosRepository.editarServico.mockResolvedValue({
      id: 18,
      nome: "Efeito clássico",
      categoria: "cilio",
    });

    await servicosService.editarServico({
      usuarioId: 1,
      id: 18,
      nome: " • Efeito clássico ",
      descricao: "",
      valor: 60,
      duracaoMinutos: 60,
      categoria: "cilio",
      ativo: true,
    });

    expect(servicosRepository.editarServico).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Efeito clássico" }),
      client
    );
  });

  test("salva bronzeamento e adiciona a especialidade ao negócio", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 16,
      ativo: true,
      categoria: "outro",
    });
    servicosRepository.editarServico.mockResolvedValue({
      id: 16,
      categoria: "bronzeamento",
    });

    await servicosService.editarServico({
      usuarioId: 1,
      id: 16,
      nome: "Bronzeamento 40 min",
      descricao: "Bronze natural com marquinha.",
      valor: 99,
      duracaoMinutos: 40,
      categoria: "bronzeamento",
      ativo: true,
    });

    expect(servicosRepository.editarServico).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: "bronzeamento" }),
      client
    );
    expect(
      servicosRepository.adicionarEspecialidadeNegocio
    ).toHaveBeenCalledWith(
      7,
      "Bronzeamento",
      client
    );
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
});
