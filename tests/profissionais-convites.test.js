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

describe("Convites de profissionais", () => {
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
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
    });
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Salão",
      limite_profissionais: 5,
      profissionais_utilizados: 1,
    });
  });

  test("criar convite não cria vínculo e não expõe e-mail/WhatsApp", async () => {
    const resultado = await profissionaisService.criarConviteProfissional({
      usuarioDonoId: 1,
      emailOuWhatsapp: "profissional@teste.com",
    });

    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
    expect(resultado.convite.profissional).toEqual({
      id: 20,
      nome: "Profissional Teste",
      foto_url: null,
    });
    expect(resultado.convite.profissional).not.toHaveProperty("email");
    expect(resultado.convite.profissional).not.toHaveProperty("whatsapp");
  });

  test("CA-EQP-01: conta inexistente não recebe convite", async () => {
    profissionaisRepository.buscarProfissionalPorEmailWhatsapp.mockResolvedValue(null);

    await expect(
      profissionaisService.criarConviteProfissional({
        usuarioDonoId: 1,
        emailOuWhatsapp: "sem-conta@teste.com",
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Profissional não encontrado. Ele precisa criar uma conta primeiro.",
    });

    expect(profissionaisRepository.criarConvite).not.toHaveBeenCalled();
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("CA-EQP-03: convite pendente de negócio arquivado não cria vínculo", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: false,
      usuario_ativo: true,
    });

    await expect(
      profissionaisService.aceitarConviteProfissional({ usuarioId: 20, conviteId: 99 })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
    expect(profissionaisRepository.atualizarStatusConvite).not.toHaveBeenCalled();
  });

  test("endpoint legado também cria apenas convite", async () => {
    await profissionaisService.vincularProfissional({
      usuarioDonoId: 1,
      emailOuWhatsapp: "62999999999",
    });

    expect(profissionaisRepository.criarConvite).toHaveBeenCalled();
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("CA-EQP-02: aceite sem vaga cria vínculo inativo aguardando capacidade", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    profissionaisRepository.criarOuMarcarVinculoAguardandoVaga.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: false,
      motivo_inatividade: "aguardando_vaga_plano",
    });
    profissionaisRepository.atualizarStatusConvite.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "aceito",
    });
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_profissionais: 1,
      profissionais_utilizados: 1,
    });

    const resultado = await profissionaisService.aceitarConviteProfissional({
      usuarioId: 20,
      conviteId: 99,
    });

    expect(
      profissionaisRepository.criarOuMarcarVinculoAguardandoVaga
    ).toHaveBeenCalledWith(20, 7, client);
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      convite: { status: "aceito" },
      vinculo: {
        ativo: false,
        estado: "aguardando_vaga",
      },
    });
    expect(resultado.mensagem).toContain("não possui uma vaga disponível");
  });

  test("usuário diferente não aceita convite de outra pessoa", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });

    await expect(
      profissionaisService.aceitarConviteProfissional({ usuarioId: 21, conviteId: 99 })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });

  test("aceite válido cria vínculo e finaliza convite na mesma transação", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    profissionaisRepository.criarVinculo.mockResolvedValue();
    profissionaisRepository.atualizarStatusConvite.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "aceito",
    });

    const resultado = await profissionaisService.aceitarConviteProfissional({
      usuarioId: 20,
      conviteId: 99,
    });

    expect(profissionaisRepository.criarVinculo).toHaveBeenCalledWith(20, 7, client);
    expect(profissionaisRepository.atualizarStatusConvite).toHaveBeenCalledWith(
      99,
      "aceito",
      client
    );
    expect(resultado.convite.status).toBe("aceito");
  });

  test("aceite reativa vínculo inativo do mesmo negócio sem inserir duplicado", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    profissionaisRepository.verificarVinculo.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: false,
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    profissionaisRepository.reativarVinculoProfissional.mockResolvedValue({ id: 501 });
    profissionaisRepository.atualizarStatusConvite.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "aceito",
    });

    const resultado = await profissionaisService.aceitarConviteProfissional({
      usuarioId: 20,
      conviteId: 99,
    });

    expect(profissionaisRepository.reativarVinculoProfissional).toHaveBeenCalledWith(
      20,
      7,
      client
    );
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
    expect(resultado.convite.status).toBe("aceito");
  });

  test("dona ativa vínculo aguardando vaga quando o plano possui capacidade", async () => {
    profissionaisRepository.verificarVinculo.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: false,
      motivo_inatividade: "aguardando_vaga_plano",
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    profissionaisRepository.ativarVinculoProfissionalAguardandoVaga.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: true,
      motivo_inatividade: null,
    });

    const resultado = await profissionaisService.ativarProfissional({
      usuarioId: 1,
      profissionalId: 20,
    });

    expect(planoService.buscarUsoPlano).toHaveBeenCalledWith(7, client);
    expect(
      profissionaisRepository.ativarVinculoProfissionalAguardandoVaga
    ).toHaveBeenCalledWith(20, 7, client);
    expect(resultado).toMatchObject({
      profissional_id: 20,
      ativo: true,
    });
  });

  test("ativação mantém vínculo aguardando quando o plano continua sem vaga", async () => {
    profissionaisRepository.verificarVinculo.mockResolvedValue({
      id: 501,
      papel: "profissional",
      ativo: false,
      motivo_inatividade: "aguardando_vaga_plano",
    });
    profissionaisRepository.buscarVinculoProfissionalAtivo.mockResolvedValue(null);
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Grátis",
      limite_profissionais: 1,
      profissionais_utilizados: 1,
    });

    await expect(
      profissionaisService.ativarProfissional({
        usuarioId: 1,
        profissionalId: 20,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      codigo: "LIMITE_PROFISSIONAIS",
    });

    expect(
      profissionaisRepository.ativarVinculoProfissionalAguardandoVaga
    ).not.toHaveBeenCalled();
  });

  test("recusa não cria vínculo", async () => {
    profissionaisRepository.buscarConviteParaAtualizacao.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "pendente",
      expira_em: new Date(Date.now() + 60_000).toISOString(),
      negocio_ativo: true,
      usuario_ativo: true,
    });
    profissionaisRepository.atualizarStatusConvite.mockResolvedValue({
      id: 99,
      negocio_id: 7,
      usuario_convidado_id: 20,
      status: "recusado",
    });

    const resultado = await profissionaisService.recusarConviteProfissional({
      usuarioId: 20,
      conviteId: 99,
    });

    expect(resultado.convite.status).toBe("recusado");
    expect(profissionaisRepository.criarVinculo).not.toHaveBeenCalled();
  });
});
