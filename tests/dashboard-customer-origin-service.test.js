jest.mock(
  "../src/repositories/dashboardRepository",
  () => ({
    buscarNegocioDoUsuario: jest.fn(),
  })
);

jest.mock(
  "../src/repositories/dashboardCustomerOriginRepository",
  () => ({
    periodoSeguro: jest.fn((value) => value || "7dias"),
    buscarOrigemClientes: jest.fn(),
  })
);

const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);
const originRepository = require(
  "../src/repositories/dashboardCustomerOriginRepository"
);
const service = require(
  "../src/services/dashboardCustomerOriginService"
);

describe("origem dos clientes no dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("resume clientes únicos, recorrência e faturamento por origem", async () => {
    dashboardRepository.buscarNegocioDoUsuario.mockResolvedValue({
      negocio_id: "12",
      papel: "dono",
    });

    originRepository.buscarOrigemClientes.mockResolvedValue([
      {
        origem_codigo: "google_ads",
        clientes: "3",
        clientes_novos: "2",
        clientes_recorrentes: "1",
        agendamentos: "5",
        faturamento: "450.50",
      },
      {
        origem_codigo: "autonomo",
        clientes: "1",
        clientes_novos: "1",
        clientes_recorrentes: "0",
        agendamentos: "1",
        faturamento: "80",
      },
      {
        origem_codigo: "nao_identificado",
        clientes: "1",
        clientes_novos: "0",
        clientes_recorrentes: "1",
        agendamentos: "2",
        faturamento: "120",
      },
    ]);

    const resultado = await service.buscarOrigemClientes({
      usuarioId: 7,
      periodo: "30dias",
    });

    expect(originRepository.buscarOrigemClientes)
      .toHaveBeenCalledWith(12, "30dias");

    expect(resultado.resumo).toEqual({
      clientes: 5,
      clientesNovos: 3,
      clientesRecorrentes: 2,
      agendamentos: 8,
      faturamento: 650.5,
      clientesPagos: 3,
      clientesAutonomos: 1,
      clientesSemOrigem: 1,
    });

    expect(resultado.origens[0]).toMatchObject({
      codigo: "google_ads",
      rotulo: "Google Ads",
      categoria: "pago",
      clientes: 3,
      percentualClientes: 60,
    });
    expect(resultado.origens[1]).toMatchObject({
      codigo: "autonomo",
      rotulo: "Acesso autônomo",
      percentualClientes: 20,
    });
  });

  test("impede profissional sem papel de dono de ver dados do negócio inteiro", async () => {
    dashboardRepository.buscarNegocioDoUsuario.mockResolvedValue({
      negocio_id: 12,
      papel: "profissional",
    });

    await expect(
      service.buscarOrigemClientes({
        usuarioId: 7,
        periodo: "7dias",
      })
    ).rejects.toMatchObject({
      message: "Apenas o dono pode acessar a origem dos clientes.",
      statusCode: 403,
    });

    expect(originRepository.buscarOrigemClientes)
      .not.toHaveBeenCalled();
  });

  test("mantém percentuais em zero quando não há clientes", async () => {
    dashboardRepository.buscarNegocioDoUsuario.mockResolvedValue({
      negocio_id: 12,
      papel: "dono",
    });
    originRepository.buscarOrigemClientes.mockResolvedValue([]);

    const resultado = await service.buscarOrigemClientes({
      usuarioId: 7,
      periodo: "7dias",
    });

    expect(resultado.resumo.clientes).toBe(0);
    expect(resultado.origens).toEqual([]);
  });
});
