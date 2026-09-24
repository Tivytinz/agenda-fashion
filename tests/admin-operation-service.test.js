jest.mock("../src/repositories/adminOperationRepository", () => ({
  listarUsuarios: jest.fn(),
  listarNegocios: jest.fn(),
  listarAgendamentos: jest.fn()
}));

const repository = require("../src/repositories/adminOperationRepository");
const service = require("../src/services/adminOperationService");

describe("adminOperationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("pagina usuários, normaliza estado e não inventa dados sensíveis", async () => {
    repository.listarUsuarios.mockResolvedValue({
      total: 26,
      rows: [{
        id: 7,
        nome: "Ana",
        email: "ana@example.com",
        ativo: false,
        desativado_em: "2026-09-20T10:00:00Z",
        encerrado_definitivo_em: null,
        email_verificado_em: "2026-09-01T10:00:00Z",
        ultimo_login_em: "2026-09-18T10:00:00Z",
        perfil_profissional_ativado_em: "2026-09-02T10:00:00Z",
        papel_admin: null,
        papeis_negocio: ["profissional"],
        total_negocios_ativos: "1"
      }]
    });

    const result = await service.listarUsuariosAdmin({
      busca: " Ana ",
      status: "DESATIVADO",
      pagina: "2",
      limite: "25"
    });

    expect(repository.listarUsuarios).toHaveBeenCalledWith({
      busca: "Ana",
      status: "desativado",
      limite: 25,
      offset: 25
    });
    expect(result.paginacao).toEqual({
      pagina: 2,
      limite: 25,
      total: 26,
      totalPaginas: 2
    });
    expect(result.usuarios[0]).toEqual(expect.objectContaining({
      id: 7,
      email: "ana@example.com",
      estado_operacional: "desativado",
      papeis_negocio: ["profissional"],
      total_negocios_ativos: 1
    }));
    expect(result.usuarios[0]).not.toHaveProperty("senha");
    expect(result.usuarios[0]).not.toHaveProperty("whatsapp");
  });

  test("normaliza busca, paginação e estado operacional dos negócios", async () => {
    repository.listarNegocios.mockResolvedValue({
      total: 51,
      rows: [{
        id: 9,
        nome: "Studio Aurora",
        cidade: "Goiânia",
        whatsapp: "62999999999",
        ativo: true,
        publicado: false,
        despublicado_manual_em: "2026-09-20T10:00:00Z",
        arquivado_em: null,
        plano_id: "2",
        plano_nome: "Autônoma",
        plano_slug: "autonoma",
        dono_id: "5",
        dono_nome: "Ana",
        total_profissionais: "2",
        total_servicos: "4",
        total_agendamentos: "12"
      }]
    });

    const result = await service.listarNegociosAdmin({
      busca: "  Aurora  ",
      status: "DESPUBLICADO",
      pagina: "2",
      limite: "25"
    });

    expect(repository.listarNegocios).toHaveBeenCalledWith({
      busca: "Aurora",
      status: "despublicado",
      limite: 25,
      offset: 25
    });
    expect(result.paginacao).toEqual({
      pagina: 2,
      limite: 25,
      total: 51,
      totalPaginas: 3
    });
    expect(result.negocios[0]).toEqual(expect.objectContaining({
      id: 9,
      nome: "Studio Aurora",
      whatsapp: "62999999999",
      whatsapp_negocio: "62999999999",
      estado_operacional: "despublicado",
      plano_nome: "Autônoma",
      dono_nome: "Ana",
      total_profissionais: 2,
      total_servicos: 4,
      total_agendamentos: 12
    }));
  });

  test("limita o tamanho da página e corrige página inválida", async () => {
    repository.listarNegocios.mockResolvedValue({ total: 0, rows: [] });

    const result = await service.listarNegociosAdmin({
      pagina: "0",
      limite: "9999"
    });

    expect(repository.listarNegocios).toHaveBeenCalledWith({
      busca: "",
      status: "",
      limite: 100,
      offset: 0
    });
    expect(result.paginacao).toEqual({
      pagina: 1,
      limite: 100,
      total: 0,
      totalPaginas: 0
    });
  });

  test("pagina agendamentos, normaliza status legado e não devolve WhatsApp do cliente final", async () => {
    repository.listarAgendamentos.mockResolvedValue({
      total: 30,
      rows: [{
        id: 7,
        data: "2026-09-04",
        horario: "18:00",
        status: "realizado",
        status_atendimento_em: "2026-09-04T21:00:00Z",
        status_atendimento_por: "8",
        status_atendimento_por_nome: "Ana",
        duracao_minutos: "60",
        antecedencia_cancelamento_horas: "2",
        cliente_id: 3,
        cliente_nome: "Maria",
        cliente_whatsapp: "62999999999",
        negocio_id: 1,
        negocio: "Studio Aurora",
        servico_id: 4,
        servico: "Manicure",
        profissional_id: 8,
        profissional: "Ana",
        valor: "50.00"
      }]
    });

    const result = await service.listarAgendamentosAdmin({
      busca: " Maria ",
      status: "concluido",
      pagina: "2",
      limite: "10"
    });

    expect(repository.listarAgendamentos).toHaveBeenCalledWith({
      busca: "Maria",
      status: "realizado",
      limite: 10,
      offset: 10
    });
    expect(result.paginacao.totalPaginas).toBe(3);
    expect(result.agendamentos[0]).toEqual(expect.objectContaining({
      cliente_nome: "Maria",
      status: "realizado",
      status_atendimento_por_nome: "Ana",
      duracao_minutos: 60,
      antecedencia_cancelamento_horas: 2
    }));
    expect(result.agendamentos[0]).not.toHaveProperty("cliente_whatsapp");
  });

  test("ignora filtro de estado desconhecido em vez de enviar valor livre ao repositório", async () => {
    repository.listarUsuarios.mockResolvedValue({ total: 0, rows: [] });

    await service.listarUsuariosAdmin({
      status: "bloqueado-pelo-frontend"
    });

    expect(repository.listarUsuarios).toHaveBeenCalledWith(expect.objectContaining({
      status: ""
    }));
  });
});
