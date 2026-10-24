const { execFileSync } = require("node:child_process");
const { types } = require("pg");
const { serializarRespostaAssinatura } = require("../src/services/assinaturaContaDto");

test.each(["UTC", "America/Sao_Paulo", "America/Los_Angeles", "Pacific/Kiritimati"])(
  "JSON da conta preserva todos os dias civis no processo em %s", (timezone) => {
    const code = `
      const { types } = require(${JSON.stringify(require.resolve("pg"))});
      const { serializarRespostaAssinatura } = require(${JSON.stringify(require.resolve("../src/services/assinaturaContaDto"))});
      const date = types.getTypeParser(1082)('2099-12-01');
      const instant = new Date('2026-10-22T13:00:00.000Z');
      const assinatura = { data_proxima_cobranca: date, created_at: instant };
      const pagamento = { data_vencimento: date, data_pagamento: date, confirmacao_observada_em: instant };
      process.stdout.write(JSON.stringify(serializarRespostaAssinatura({
        assinatura, acesso_ate: date, pagamentos: [pagamento], pagamento_recuperavel: pagamento,
        upgrade_pendente: { assinatura, pagamento }
      })));
    `;
    const dto = JSON.parse(execFileSync(process.execPath, ["-e", code], {
      env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 10000,
    }));
    expect(dto.assinatura).toEqual({ acesso_pago_ate: "2099-12-01", data_proxima_cobranca: "2099-12-01", created_at: "2026-10-22T13:00:00.000Z" });
    expect(dto.acesso_ate).toBe("2099-12-01");
    expect(dto.upgrade_pendente.assinatura).toEqual(dto.assinatura);
    for (const pagamento of [dto.pagamentos[0], dto.pagamento_recuperavel, dto.upgrade_pendente.pagamento]) {
      expect(pagamento).toEqual({ data_vencimento: "2099-12-01", data_pagamento: "2099-12-01",
        confirmacao_observada_em: "2026-10-22T13:00:00.000Z" });
    }
  }
);

test("ausência ou data inválida vira null sem alterar os objetos persistidos", () => {
  const assinatura = { data_proxima_cobranca: types.getTypeParser(1082)("2099-12-01") };
  const pagamento = { data_pagamento: null, data_vencimento: "2026-02-31" };
  const dto = serializarRespostaAssinatura({ assinatura, pagamentos: [pagamento], upgrade_pendente: null });
  expect(dto.pagamentos).toEqual([{ data_pagamento: null, data_vencimento: null }]);
  expect(dto.upgrade_pendente).toBeNull();
  expect(assinatura.data_proxima_cobranca).toBeInstanceOf(Date);
  expect(pagamento.data_vencimento).toBe("2026-02-31");
});

test("metadados internos da tentativa não vazam na conta ou no upgrade", () => {
  const assinatura = { id: 20, data_proxima_cobranca: "2099-12-01", reativacao_inicio_cobranca: new Date(), renovacao_chave_versao: 1 };
  const dto = serializarRespostaAssinatura({ assinatura, upgrade_pendente: { assinatura, pagamento: null } });
  expect(dto.assinatura).toEqual({ id: 20, acesso_pago_ate: "2099-12-01", data_proxima_cobranca: "2099-12-01" });
  expect(dto.upgrade_pendente.assinatura).toEqual(dto.assinatura);
  expect(assinatura).toHaveProperty("reativacao_inicio_cobranca");
});
