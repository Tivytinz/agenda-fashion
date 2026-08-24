jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/servicosRepository");

jest.mock("../src/services/planoService", () => ({
  buscarUsoPlano: jest.fn(),
  criarErroLimite: jest.fn((mensagem, codigo, uso = null) => {
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
const planoService = require("../src/services/planoService");
const servicoAtivacaoService = require("../src/services/servicoAtivacaoService");

describe("Escolha de serviços ativos", () => {
  const client = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.executarTransacao.mockImplementation(async (callback) => callback(client));
    servicosRepository.buscarNegocioDono.mockResolvedValue({ negocio_id: 7 });
    servicosRepository.sincronizarPublicacaoAutomatica.mockResolvedValue({
      id: 7,
      publicado: true,
    });
  });

  test("permite desativar um serviço para liberar vaga no plano", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 9,
      nome: "Manicure",
      ativo: true,
    });
    client.query.mockResolvedValue({
      rows: [{ id: 9, nome: "Manicure", ativo: false }],
    });

    const resultado = await servicoAtivacaoService.alterarAtivoServico({
      usuarioId: 1,
      id: 9,
      ativo: false,
    });

    expect(resultado.servico.ativo).toBe(false);
    expect(planoService.buscarUsoPlano).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE servicos_negocio"),
      [false, 9, 7]
    );
  });

  test("bloqueia ativação quando as duas vagas do Grátis estão ocupadas", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 10,
      nome: "Pedicure",
      ativo: false,
    });
    servicosRepository.bloquearCadastroServico.mockResolvedValue();
    planoService.buscarUsoPlano.mockResolvedValue({
      plano_nome: "Grátis",
      limite_servicos: 2,
    });
    servicosRepository.contarServicosAtivos.mockResolvedValue(2);

    await expect(
      servicoAtivacaoService.alterarAtivoServico({
        usuarioId: 1,
        id: 10,
        ativo: true,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      codigo: "LIMITE_SERVICOS",
      uso: {
        plano_nome: "Grátis",
        utilizados: 2,
        limite: 2,
      },
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  test("ativa outro serviço depois que existe uma vaga disponível", async () => {
    servicosRepository.buscarServicoDoNegocio.mockResolvedValue({
      id: 10,
      nome: "Pedicure",
      ativo: false,
    });
    servicosRepository.bloquearCadastroServico.mockResolvedValue();
    planoService.buscarUsoPlano.mockResolvedValue({
      plano_nome: "Grátis",
      limite_servicos: 2,
    });
    servicosRepository.contarServicosAtivos.mockResolvedValue(1);
    client.query.mockResolvedValue({
      rows: [{ id: 10, nome: "Pedicure", ativo: true }],
    });

    const resultado = await servicoAtivacaoService.alterarAtivoServico({
      usuarioId: 1,
      id: 10,
      ativo: true,
    });

    expect(resultado.servico.ativo).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE servicos_negocio"),
      [true, 10, 7]
    );
  });
});