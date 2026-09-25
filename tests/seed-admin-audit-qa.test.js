const { validateConfig, seed } = require("../scripts/seed-admin-audit-qa");

const valid = {
  NODE_ENV: "test",
  PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:5432/audit_qa",
  PERF_ADMIN_QA_DATABASE_NAME: "audit_qa",
  PERF_ADMIN_SEED_CONFIRM: "audit_qa",
  PERF_ADMIN_SEED_ATTEMPTS: "1000",
  PERF_ADMIN_SEED_RESULTS: "800",
  PERF_ADMIN_SEED_REVIEWS: "100",
  PERF_ADMIN_SEED_PENDING: "100"
};

test("aceita somente banco local descartável e contagens reconciliadas", () => {
  expect(validateConfig(valid)).toMatchObject({
    name: "audit_qa", attempts: 1000, results: 800, reviews: 100, pending: 100
  });
  for (const bad of [
    { NODE_ENV: "production" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@db.railway.app:5432/audit_qa" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1/audit_qa?host=db.railway.app" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:5432/agenda_fashion" },
    { PERF_ADMIN_SEED_CONFIRM: "outro_qa" },
    { PERF_ADMIN_SEED_PENDING: "101" }
  ]) {
    expect(() => validateConfig({ ...valid, ...bad })).toThrow();
  }
});

test("recusa popular banco com auditoria existente e desfaz a transação", async () => {
  const queries = [];
  const client = {
    query: jest.fn(async (sql) => {
      queries.push(sql);
      if (sql.includes("current_database()")) {
        return { rows: [{ name: "audit_qa", events: 1, reviews: 0 }] };
      }
      return { rows: [] };
    })
  };
  await expect(seed(client, validateConfig(valid))).rejects.toThrow(/não está vazio/);
  expect(queries).toContain("BEGIN");
  expect(queries).toContain("ROLLBACK");
  expect(queries).not.toContain("COMMIT");
  expect(queries.some((sql) => sql.includes("INSERT INTO"))).toBe(false);
});

test("desfaz a carga inteira se uma contagem inserida divergir", async () => {
  const queries = [];
  const client = {
    query: jest.fn(async (sql) => {
      queries.push(sql);
      if (sql.includes("current_database()")) {
        return { rows: [{ name: "audit_qa", events: 0, reviews: 0 }] };
      }
      if (sql.includes("INSERT INTO admin_auditoria_eventos")) {
        return { rowCount: sql.includes("'RESULTADO'") ? 799 : 1000 };
      }
      if (sql.includes("INSERT INTO admin_auditoria_revisoes")) return { rowCount: 100 };
      return { rows: [] };
    })
  };
  await expect(seed(client, validateConfig(valid))).rejects.toThrow(/Contagens/);
  expect(queries).toContain("ROLLBACK");
  expect(queries).not.toContain("COMMIT");
});
