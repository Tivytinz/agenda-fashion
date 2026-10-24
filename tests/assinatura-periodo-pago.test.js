jest.mock("../src/repositories/assinaturaRepository", () => ({ listarPagamentos: jest.fn() }));
const repository = require("../src/repositories/assinaturaRepository");
const { calcularFimDoPeriodoPago } = require("../src/services/assinaturaPeriodoPagoService");
const { types } = require("pg");
const client = { query: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test("usa maior período e a mesma conexão da transação, sem depender da ordem dos IDs", async () => {
  repository.listarPagamentos.mockResolvedValue([
    { status: "RECEIVED", data_pagamento: "2099-01-01" },
    { status: "CONFIRMED", data_pagamento: types.getTypeParser(1082)("2099-12-01") },
    { status: "RECEIVED", data_pagamento: null, data_vencimento: null },
    { status: "PENDING", data_vencimento: "2101-01-01" },
  ]);
  await expect(calcularFimDoPeriodoPago({ id: 20, ativo: true, data_proxima_cobranca: "2099-12-01" }, client)).resolves.toBe("2100-01-01");
  expect(repository.listarPagamentos).toHaveBeenCalledWith(20, client, null);
});

test.each(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])("vencimento civil válido é fallback de %s", async (status) => {
  repository.listarPagamentos.mockResolvedValue([{ status, data_vencimento: "2028-01-31" }]);
  await expect(calcularFimDoPeriodoPago({ id: 20 })).resolves.toBe("2028-02-29");
});

test("dado financeiro incompleto não encurta nem estende a data conhecida", async () => {
  repository.listarPagamentos.mockResolvedValue([{ status: "RECEIVED" }, { status: "PENDING", data_vencimento: "2101-01-01" }]);
  await expect(calcularFimDoPeriodoPago({ id: 20, ativo: true, data_proxima_cobranca: "2100-01-01" })).resolves.toBe("2100-01-01");
});

test("sem evidência confiável não inventa período", async () => {
  repository.listarPagamentos.mockResolvedValue([{ status: "RECEIVED", data_pagamento: "2026-02-31" }]);
  await expect(calcularFimDoPeriodoPago({ id: 20 })).rejects.toMatchObject({ status: 409 });
});


test("programação futura sem acesso confirmado não amplia o período quitado", async () => {
  repository.listarPagamentos.mockResolvedValue([{ status: "RECEIVED", data_pagamento: "2026-10-01" }]);
  await expect(calcularFimDoPeriodoPago({ id: 20, ativo: false, acesso_pago_ate: null,
    data_proxima_cobranca: "2030-01-01" })).resolves.toBe("2026-11-01");
});

test("fim pago conhecido independe de programação externa posterior", async () => {
  repository.listarPagamentos.mockResolvedValue([]);
  await expect(calcularFimDoPeriodoPago({ id: 20, ativo: true, acesso_pago_ate: "2026-11-01",
    data_proxima_cobranca: "2030-01-01" })).resolves.toBe("2026-11-01");
});

test("após reversão, máximo histórico não supera o período dos pagamentos ainda válidos", async () => {
  repository.listarPagamentos.mockResolvedValue([
    { status: "RECEIVED", data_pagamento: "2026-09-23" },
    { status: "REFUNDED", data_pagamento: "2026-10-23" },
  ]);
  await expect(calcularFimDoPeriodoPago({ id:20,ativo:true,acesso_pago_ate:"2026-11-23",
    acesso_pago_reconciliado:true },client)).resolves.toBe("2026-10-23");
});

test("reconciliação explícita remove evidência invalidada e permite ausência de cobertura", async () => {
  repository.listarPagamentos.mockResolvedValue([{ status:"REFUNDED",data_pagamento:"2099-12-01" }]);
  await expect(calcularFimDoPeriodoPago({id:20,ativo:true,acesso_pago_ate:"2100-01-01"},client,
    {reconciliar:true,permitirAusente:true})).resolves.toBeNull();
});
