jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/profissionaisRepository");

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
const profissionaisRepository = require("../src/repositories/profissionaisRepository");
const planoService = require("../src/services/planoService");
const profissionaisService = require("../src/services/profissionaisService");

describe("Limite de profissionais", () => {
  const client = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    db.executarTransacao.mockImplementation(async (callback) => callback(client));
    profissionaisRepository.buscarNegocioDono.mockResolvedValue({ negocio_id: 7 });
    profissionaisRepository.buscarProfissionalPorEmailWhatsapp.mockResolvedValue({
      id: 20,
      nome: "Profissional Teste",
      foto_url: null,
    });
    profissionaisRepository.bloquearCadastroProfissional.mockResolvedValue();
    profissionaisRepository.verificarVinculo.mockResolvedValue(null);
    profissionaisRepository.expirarConvitesPendentes.mockResolvedValue();
    profissionaisRepository.buscarConvitePendente.mockResolvedValue(null);
    profissionaisRepository.criarConvite.mockResolvedValue({
      id: 90,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    profissionaisRepository.ativarPerfilProfissionalConta.mockResolvedValue({
      id: 20,
      perfil_profissional_ativado_em:
        new Date().toISOString(),
    });
    profissionaisRepository.criarOuMarcarVinculoAguardandoVaga.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: false,
      motivo_inatividade: "aguardando_vaga_plano",
    });
    profissionaisRepository.atualizarStatusConvite.mockResolvedValue({
      id: 90,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "aceito",
    });
  });

  test("convite pendente não consome nem valida vaga do plano", async () => {
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_profissionais: 1,
      profissionais_utilizados: 1,
    });

    const resultado = await profissionaisService.criarConviteProfissional({
      usuarioDonoId: 1,
      emailOuWhatsapp: "profissional@teste.com",
    });

    expect(resultado.convite.status).toBe("pendente");
    expect(planoService.buscarUsoPlano).not.toHaveBeenCalled();
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("CA-EQP-02: aceite usa o plano efetivo e aguarda vaga quando a capacidade acabou", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 90,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_profissionais: 1,
      profissionais_utilizados: 1,
    });

    const resultado = await profissionaisService.aceitarConviteProfissional({
      usuarioId: 20,
      conviteId: 90,
    });

    expect(resultado).toMatchObject({
      convite: { status: "aceito" },
      vinculo: {
        ativo: false,
        estado: "aguardando_vaga",
      },
    });
    expect(planoService.buscarUsoPlano).toHaveBeenCalledWith(7, client);
    expect(
      profissionaisRepository.criarOuMarcarVinculoAguardandoVaga
    ).toHaveBeenCalledWith(20, 7, client);
    expect(profissionaisRepository.atualizarStatusConvite).toHaveBeenCalledWith(
      90,
      "aceito",
      client
    );
    expect(profissionaisRepository.buscarPlanoDoNegocio).not.toHaveBeenCalled();
    expect(profissionaisRepository.contarProfissionaisAtivos).not.toHaveBeenCalled();
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("após downgrade preserva a equipe ativa e coloca novo aceite na espera", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 90,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_profissionais: 1,
      profissionais_utilizados: 3,
    });

    const resultado = await profissionaisService.aceitarConviteProfissional({
      usuarioId: 20,
      conviteId: 90,
    });

    expect(resultado).toMatchObject({
      convite: { status: "aceito" },
      vinculo: {
        ativo: false,
        estado: "aguardando_vaga",
      },
    });
    expect(
      profissionaisRepository.criarOuMarcarVinculoAguardandoVaga
    ).toHaveBeenCalledWith(20, 7, client);
    expect(profissionaisRepository.removerVinculo).not.toHaveBeenCalled();
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("lista a equipe existente sem depender de dados do convite", async () => {
    profissionaisRepository.listarProfissionaisDoNegocio.mockResolvedValue([
      { id: 1, nome: "Dona", foto_url: null, papel: "dono" }
    ]);

    const resultado = await profissionaisService.listarProfissionais({ usuarioId: 1 });

    expect(profissionaisRepository.listarProfissionaisDoNegocio).toHaveBeenCalledWith(7);
    expect(resultado.profissionais).toEqual([
      expect.objectContaining({ id: 1, nome: "Dona", papel: "dono" })
    ]);
  });

  test("edição normaliza nome e WhatsApp antes de atualizar", async () => {
    profissionaisRepository.verificarProfissionalNoNegocio.mockResolvedValue({ id: 30 });
    profissionaisRepository.atualizarProfissional.mockResolvedValue({
      id: 20,
      nome: "Profissional Teste",
      whatsapp: "62999991234",
    });

    await profissionaisService.editarProfissional({
      usuarioId: 1,
      profissionalId: 20,
      nome: "  Profissional Teste  ",
      whatsapp: "(62) 99999-1234",
    });

    expect(profissionaisRepository.atualizarProfissional).toHaveBeenCalledWith(
      20,
      7,
      "Profissional Teste",
      "62999991234"
    );
  });

  test("identificador inválido não procura uma conta aleatória", async () => {
    await expect(
      profissionaisService.vincularProfissional({
        usuarioDonoId: 1,
        emailOuWhatsapp: "email-invalido1234567890@",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Informe um e-mail ou WhatsApp válido.",
    });

    expect(profissionaisRepository.buscarProfissionalPorEmailWhatsapp).not.toHaveBeenCalled();
  });
});
