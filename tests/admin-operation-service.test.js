jest.mock("../src/repositories/adminOperationRepository", () => ({
  listarNegocios: jest.fn(),
  listarAgendamentos: jest.fn()
}));

const repository = require("../src/repositories/adminOperationRepository");
const service = require("../src/services/adminOperationService");

describe("adminOperationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normaliza busca, paginação e preserva alias legado de WhatsApp dos negócios", async () => {
    repository.listarNegocios.mockResolvedValue({
      total: 51,
      rows: [{
        id: 9,
        nome: "Studio Aurora",
        cidade: "Goiânia",
        whatsapp: "62999999999",
        ativo: true,
        total_profissionais: "2",
        total_servicos: "4",
        total_agendamentos: "12"
      }]
    });

    const result = await service.listarNegociosAdmin({
      busca: "  Aurora  ",
      pagina: "2",
      limite: "25"
    });

    expect(repository.listarNegocios).toHaveBeenCalledWith({
      busca: "Aurora",
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

  test("pagina agendamentos e não devolve WhatsApp do cliente final", async () => {
    repository.listarAgendamentos.mockResolvedValue({
      total: 30,
      rows: [{
        id: 7,
        data: "2026-09-04",
        horario: "18:00",
        status: "confirmado",
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
      status: "confirmado",
      pagina: "2",
      limite: "10"
    });

    expect(repository.listarAgendamentos).toHaveBeenCalledWith({
      busca: "Maria",
      status: "confirmado",
      limite: 10,
      offset: 10
    });
    expect(result.paginacao.totalPaginas).toBe(3);
    expect(result.agendamentos[0].cliente_nome).toBe("Maria");
    expect(result.agendamentos[0]).not.toHaveProperty("cliente_whatsapp");
  });
});
