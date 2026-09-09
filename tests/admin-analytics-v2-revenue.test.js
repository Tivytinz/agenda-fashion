jest.mock(
  "../src/repositories/adminAnalyticsV2Repository",
  () => ({
    periodoSeguro: jest.fn((periodo) => periodo || "30"),
    buscarReceita: jest.fn(),
    buscarVisaoGeral: jest.fn(),
    listarAquisicao: jest.fn(),
    buscarJornada: jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalFunnelService",
  () => ({
    buscarFunil: jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceService",
  () => ({
    buscarRecorrencia: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminAnalyticsV2Repository"
);
const service = require(
  "../src/services/adminAnalyticsV2Service"
);

describe("Admin Analytics V2 - receita", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calcula checkout para assinatura com a mesma coorte de negócios", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "30",
      resumo: {
        checkouts_iniciados: 10,
        checkouts_concluidos: 7,
        checkouts_falhos: 2,
        negocios_com_checkout: 4,
        negocios_checkout_convertidos: 1,
        pagamentos_confirmados: 12,
        negocios_pagantes: 6,
        novas_assinaturas_pagas: 9,
        assinaturas_pagas_ativas: 8,
        receita_total: "1290.00",
        receita_primeiro_pagamento: "870.00",
      },
      planos: [],
    });

    const resultado = await service.buscarRevenue("30");

    expect(resultado.resumo).toMatchObject({
      checkoutsIniciados: 10,
      negociosComCheckoutCohorte: 4,
      negociosCheckoutConvertidos: 1,
      conversaoCheckoutParaAssinaturaPaga: 25,
      novasAssinaturasPagas: 9,
    });

    expect(
      resultado.resumo.conversaoCheckoutParaAssinaturaPaga
    ).not.toBe(90);
  });

  test("não inventa conversão quando a coorte de checkout está vazia", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "7",
      resumo: {
        checkouts_iniciados: 0,
        negocios_com_checkout: 0,
        negocios_checkout_convertidos: 0,
        novas_assinaturas_pagas: 2,
      },
      planos: [],
    });

    const resultado = await service.buscarRevenue("7");

    expect(
      resultado.resumo.conversaoCheckoutParaAssinaturaPaga
    ).toBeNull();
    expect(resultado.resumo.novasAssinaturasPagas).toBe(2);
  });
});
