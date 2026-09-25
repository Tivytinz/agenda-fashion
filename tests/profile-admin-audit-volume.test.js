const { validateConfig, profile } = require("../scripts/profile-admin-audit-volume");

const env = {
  PERF_ADMIN_PROFILE_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:5432/audit_qa",
  PERF_ADMIN_PROFILE_CONFIRM_DATABASE: "audit_qa",
  PERF_ADMIN_PROFILE_READ_ONLY: "auditoria"
};

test("exige confirmação explícita e leitura somente agregada", () => {
  expect(validateConfig(env).name).toBe("audit_qa");
  expect(() => validateConfig({ ...env, PERF_ADMIN_PROFILE_READ_ONLY: "" })).toThrow();
  expect(() => validateConfig({ ...env, PERF_ADMIN_PROFILE_CONFIRM_DATABASE: "outro_qa" })).toThrow();
});

test("obtém apenas contagens agregadas numa transação somente leitura", async () => {
  const sql = [];
  const client = {
    query: jest.fn(async (statement) => {
      sql.push(statement);
      if (statement.includes("current_database()")) return { rows: [{ name: "audit_qa" }] };
      if (statement.includes("COUNT(DISTINCT")) return { rows: [{
        attempts: "1000", results: "800", reviews: "100", pending: "100",
        last30days: "850", actors: "12"
      }] };
      if (statement.includes("GROUP BY acao")) {
        return { rows: [{ acao: "campanha_criar", total: "1000" }] };
      }
      return { rows: [] };
    })
  };
  const result = await profile(client, validateConfig(env));
  expect(result).toMatchObject({ attempts: 1000, results: 800,
    reviews: 100, pending: 100, actors: 12 });
  expect(sql[0]).toBe("BEGIN READ ONLY");
  expect(sql).toContain("COMMIT");
  expect(sql.some((statement) => /INSERT|UPDATE|DELETE|TRUNCATE/i.test(statement))).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(/private-pass|usuario_id|request_id/);
});
