const { config, createActor } = require("../scripts/create-admin-audit-qa-actor");

const env = {
  NODE_ENV: "test", DATABASE_URL: "postgresql://qa:test@127.0.0.1:5432/audit_qa",
  PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:test@127.0.0.1:5432/audit_qa",
  PERF_ADMIN_QA_DATABASE_NAME: "audit_qa", PERF_ADMIN_QA_ACTOR_CONFIRM: "audit_qa",
  JWT_SECRET: "qa-secret-with-at-least-32-characters", GITHUB_ENV: "/tmp/qa-env"
};

test("recusa banco remoto, divergente ou com parâmetros de host", () => {
  expect(config(env).name).toBe("audit_qa");
  for (const bad of [
    { NODE_ENV: "production" }, { PERF_ADMIN_QA_ACTOR_CONFIRM: "prod_qa" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:test@db.railway.app/audit_qa" },
    { PERF_ADMIN_QA_DATABASE_URL: `${env.DATABASE_URL}?host=db.railway.app` }
  ]) expect(() => config({ ...env, ...bad })).toThrow();
});

test("desfaz a transação quando o banco efetivo diverge", async () => {
  const sql = [];
  const client = { query: jest.fn(async (statement) => {
    sql.push(statement);
    return statement.includes("current_database()")
      ? { rows: [{ name: "production" }] } : { rows: [] };
  }) };
  await expect(createActor(client, config(env))).rejects.toThrow(/não corresponde/);
  expect(sql).toContain("ROLLBACK");
  expect(sql.some((query) => query.includes("INSERT INTO"))).toBe(false);
});
