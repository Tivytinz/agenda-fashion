const { config, validProfile, report } = require("../scripts/qualify-admin-audit-qa");

const sha = "a".repeat(40);
const env = {
  NODE_ENV: "test", PERF_ADMIN_TARGET_URL: "http://127.0.0.1:3000",
  PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private@127.0.0.1:5432/audit_qa",
  PERF_ADMIN_QA_DATABASE_NAME: "audit_qa", PERF_ADMIN_BUILD_SHA: sha,
  PERF_ADMIN_ACTOR_ID: "900000000001", PERF_ADMIN_TOKEN: "private-token",
  PERF_ADMIN_REFERENCE_FILE: "/tmp/reference.json"
};

const profile = (attempts, results, reviews, pending) => ({
  cenario: "perfil_aggregate_auditoria", medidoEm: "2026-09-25T12:00:00.000Z",
  attempts, results, reviews, pending, last30days: attempts, actors: 1,
  acoes: [{ acao: "campanha_criar", total: attempts }]
});
const measurement = (cenario, extra = {}) => ({
  cenario, amostras: 10, concorrencia: 2, p95Ms: 1200, limiteMs: 2000,
  aprovado: true, ...extra
});
const writes = [
  { cenario: "perfil", buildSha: sha, banco: "audit_qa",
    tentativasAntes: 1000, revisoesAntes: 100 },
  measurement("campanha_criar"), measurement("auditoria_revisar"),
  { cenario: "integridade", aprovado: true, paresAuditoria: 26, revisoes: 13 }
];
const reads = ["recentes", "pendentes", "revisadas", "ator"]
  .map((cenario) => measurement(cenario, { buildSha: sha }));

test("recusa qualificação em alvo remoto ou banco não confirmado", () => {
  expect(config(env).name).toBe("audit_qa");
  for (const override of [
    { PERF_ADMIN_TARGET_URL: "https://app.agendafashion.com.br" },
    { PERF_ADMIN_QA_DATABASE_NAME: "production_qa" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private@db.railway.app/audit_qa" },
    { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private@127.0.0.1/audit_qa?host=db.railway.app" },
    { NODE_ENV: "production" }
  ]) expect(() => config({ ...env, ...override })).toThrow();
});

test("aceita apenas perfil agregado reconciliado", () => {
  expect(validProfile(profile(1000, 800, 100, 100)).attempts).toBe(1000);
  expect(() => validProfile(profile(1000, 800, 100, 101))).toThrow();
});

test("reúne seis cenários e integridade, sem declarar ADM-043 coberto", () => {
  const result = report(profile(1000, 800, 100, 100),
    profile(1000, 800, 100, 100), profile(1040, 826, 113, 101),
    writes, reads, config(env));
  expect(result.medidas).toHaveLength(6);
  expect(result.p95Aprovado).toBe(true);
  expect(result.adm043).toBe("PENDENTE_VALIDACAO_REPRESENTATIVIDADE");
  expect(JSON.stringify(result)).not.toMatch(/private|reference.json/);
});

test("preserva p95 reprovado, mas recusa integridade ou build divergente", () => {
  const before = profile(1000, 800, 100, 100);
  const after = profile(1040, 826, 113, 101);
  const failed = reads.map((row) => row.cenario === "pendentes"
    ? measurement("pendentes", { p95Ms: 2200, aprovado: false, buildSha: sha }) : row);
  expect(report(before, before, after, writes, failed, config(env)).p95Aprovado).toBe(false);
  expect(() => report(before, before, after, writes,
    failed.map((row) => row.cenario === "ator" ? { ...row, buildSha: "b".repeat(40) } : row),
    config(env))).toThrow(/Medição incompleta/);
  expect(() => report(before, before, after,
    writes.map((row) => row.cenario === "integridade" ? { ...row, paresAuditoria: 25 } : row),
    reads, config(env))).toThrow(/integridade/);
});
