jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn(),
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/repositories/planoRepository"
);

jest.mock(
  "../src/services/equipePlanoService",
  () => ({
    reconciliarLimiteProfissionais:
      jest.fn().mockResolvedValue([]),
  })
);

jest.mock(
  "../src/services/assinaturaLifecycleService",
  () => ({
    registrarEncerramentoAcesso:
      jest.fn().mockResolvedValue(null),
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const lifecycle = require(
  "../src/services/assinaturaLifecycleService"
);
const equipePlanoService = require(
  "../src/services/equipePlanoService"
);
const {
  expirarCancelamentoComReconciliacao,
} = require("../src/services/planoService");

describe("expiração do período pago - lifecycle", () => {
  test("registra saída da base paga antes de reconciliar a equipe", async () => {
    const executor = {
      query: jest.fn(),
    };
    const expirada = {
      id: 20,
      negocio_id: 7,
      plano_id: 2,
      status: "CANCELED",
      ativo: false,
      data_proxima_cobranca: "2026-10-23",
      negocio_saiu_base_paga: true,
    };

    assinaturaRepository
      .expirarCancelamentoSeNecessario
      .mockResolvedValue(expirada);

    const resultado =
      await expirarCancelamentoComReconciliacao(
        7,
        executor
      );

    expect(
      lifecycle.registrarEncerramentoAcesso
    ).toHaveBeenCalledWith({
      client: executor,
      assinatura: expirada,
      origem: "sistema",
      referenciaIdempotencia: "2026-10-23",
      test("não registra saída quando outro plano pago mantém o negócio na base", async () => {
    const executor = {
      query: jest.fn(),
    };
    assinaturaRepository
      .expirarCancelamentoSeNecessario
      .mockResolvedValue({
        id: 20,
        negocio_id: 7,
        plano_id: 2,
        status: "CANCELED",
        ativo: false,
        data_proxima_cobranca: "2026-10-23",
        negocio_saiu_base_paga: false,
      });

    await expirarCancelamentoComReconciliacao(
      7,
      executor
    );

    expect(
      lifecycle.registrarEncerramentoAcesso
    ).not.toHaveBeenCalled();
    expect(
      equipePlanoService
        .reconciliarLimiteProfissionais
    ).not.toHaveBeenCalled();
  });
});
    expect(
      equipePlanoService
        .reconciliarLimiteProfissionais
    ).toHaveBeenCalledWith(
      7,
      executor
    );
    expect(resultado).toBe(expirada);
  });
});
