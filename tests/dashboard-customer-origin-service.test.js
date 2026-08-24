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

  test("separa pago, orgânico, autônomo e histórico sem origem", async () => {
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
        origem_codigo: "google_organico",
        clientes: "2",
        clientes_novos: "1",
        clientes_recorrentes: "1",
        agendamentos: "3",
        faturamento: "200",
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
      clientes: 7,
      clientesNovos: 4,
      clientesRecorrentes: 3,
      agendamentos: 11,
      faturamento: 850.5,
      clientesPagos: 3,
      clientesOrganicos: 2,
      clientesAutonomos: 1,
      clientesSemOrigem: 1,
      agendamentosPagos: 5,
      agendamentosOrganicos: 3,
      faturamentoPago: 450.5,
      faturamentoOrganico: 200,
      percentualPago: 42.9,
      percentualOrganico: 28.6,
      percentualAutonomo: 14.3,
    });

    expect(resultado.origens[0]).toMatchObject({
      codigo: "google_ads",
      rotulo: "Google Ads",
      categoria: "pago",
      clientes: 3,
      percentualClientes: 42.9,
    });
    expect(resultado.origens[1]).toMatchObject({
      codigo: "google_organico",
      rotulo: "Google orgânico",
      categoria: "organico",
      clientes: 2,
      percentualClientes: 28.6,
    });
    expect(resultado.origens[2]).toMatchObject({
      codigo: "autonomo",
      rotulo: "Acesso autônomo",
      percentualClientes: 14.3,
    });
  });

  test("fbclid sem mídia paga é descrito como Meta orgânico", () => {
    expect(service.normalizarLinha({
      origem_codigo: "meta_organico",
      clientes: 1,
    })).toMatchObject({
      rotulo: "Meta orgânico",
      categoria: "organico",
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
    expect(resultado.resumo.percentualPago).toBe(0);
    expect(resultado.resumo.percentualOrganico).toBe(0);
    expect(resultado.origens).toEqual([]);
  });
});
