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
const uploadToCloudinary = require("../src/utils/uploadCloudinary");
const servicosService = require("../src/services/servicosService");

describe("Edição completa de serviços", () => {
  const client = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    uploadToCloudinary.remover = jest.fn().mockResolvedValue(undefined);
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

  test("escolhe uma foto da galeria como capa sem apagar uma capa antiga ainda usada na galeria", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 12,
      foto_url: "https://img/antiga.jpg",
      foto_public_id: "galeria/antiga",
    });
    servicosRepository.buscarFotoGaleriaDoNegocio.mockResolvedValue({
      id: 22,
      servico_id: 12,
      foto_url: "https://img/nova.jpg",
      foto_public_id: "galeria/nova",
    });
    servicosRepository.atualizarFotoServico.mockResolvedValue({
      id: 12,
      foto_url: "https://img/nova.jpg",
      foto_public_id: "galeria/nova",
    });
    servicosRepository.fotoGaleriaUsaPublicId.mockResolvedValue(true);

    const resultado = await servicosService.definirFotoCapaServico({
      usuarioId: 1,
      id: 12,
      fotoId: 22,
    });

    expect(servicosRepository.atualizarFotoServico).toHaveBeenCalledWith({
      id: 12,
      negocioId: 7,
      fotoUrl: "https://img/nova.jpg",
      fotoPublicId: "galeria/nova",
    });
    expect(servicosRepository.fotoGaleriaUsaPublicId).toHaveBeenCalledWith({
      servicoId: 12,
      fotoPublicId: "galeria/antiga",
    });
    expect(uploadToCloudinary.remover).not.toHaveBeenCalled();
    expect(resultado.servico.foto_public_id).toBe("galeria/nova");
  });

  test("ao remover da galeria a foto que era capa, limpa a capa junto", async () => {
    servicosRepository.buscarFotoGaleriaDoNegocio.mockResolvedValue({
      id: 31,
      servico_id: 12,
      foto_public_id: "galeria/capa",
    });
    servicosRepository.limparFotoServicoSeUsarPublicId.mockResolvedValue({ id: 12 });
    servicosRepository.removerFotoGaleriaServico.mockResolvedValue({
      id: 31,
      servico_id: 12,
      foto_public_id: "galeria/capa",
    });

    const resultado = await servicosService.removerFotoGaleriaServico({
      usuarioId: 1,
      fotoId: 31,
    });

    expect(servicosRepository.limparFotoServicoSeUsarPublicId).toHaveBeenCalledWith(
      {
        id: 12,
        negocioId: 7,
        fotoPublicId: "galeria/capa",
      },
      client
    );
    expect(resultado.capa_removida).toBe(true);
    expect(uploadToCloudinary.remover).toHaveBeenCalledWith("galeria/capa");
  });
});
