jest.setTimeout(30000);
const db = require("../src/db/db");
const services = require("../src/services/servicosService");
const activation = require("../src/services/servicoAtivacaoService");
const repo = require("../src/repositories/servicosRepository");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
// PGlite e pools unitários não exercitam espera circular entre conexões.
// O Backend CI usa PostgreSQL nativo e pool com várias conexões.
const concurrentTest = Number(process.env.DB_POOL_MAX || 10) >= 3 ? test : test.skip;
let scenario;
afterEach(async () => { jest.restoreAllMocks(); if (scenario) await removerCenarioAgendamento(db, scenario); scenario = null; });
afterAll(() => db.end());
concurrentTest.each(["reativacao", "edicao"])("criação e %s concorrentes respeitam a mesma ordem de locks", async kind => {
  scenario = await criarCenarioAgendamento(db, { prefixo: "service-lock-order" });
  const usuarioId = scenario.profissional.id;
  await activation.alterarAtivoServico({ usuarioId, id: scenario.servico.id, ativo: false });
  let acquired; let release;
  const barrier = new Promise(resolve => { acquired = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  const original = repo.bloquearCadastroServico;
  let first = true;
  jest.spyOn(repo, "bloquearCadastroServico").mockImplementation(async (...args) => {
    await original(...args);
    if (first) { first = false; acquired(); await resume; }
  });
  const changing = kind === "reativacao"
    ? activation.alterarAtivoServico({ usuarioId, id: scenario.servico.id, ativo: true })
    : services.editarServico({ usuarioId, id: scenario.servico.id, nome: "Oferta reativada", valor: 50, duracaoMinutos: 60, categoria: "unha", ativo: true });
  await barrier;
  const creating = services.criarServico({ usuarioId, negocioId: scenario.negocioId, nome: "Nova oferta concorrente", valor: 50,
    duracaoMinutos: 30, categoria: "unha", ativo: true, chaveIdempotencia: `foto-lock-create-${kind}` });
  try {
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const result = await db.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=$1::oid AND NOT granted) AS waiting", [scenario.negocioId]);
      waiting = result.rows[0].waiting;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(true);
  } finally { release(); }
  const results = await Promise.allSettled([changing, creating]);
  expect(results.map(result => result.status)).toEqual(["fulfilled", "fulfilled"]);
  const count = await db.query("SELECT COUNT(*)::int AS total FROM servicos_negocio WHERE negocio_id=$1 AND ativo", [scenario.negocioId]);
  expect(count.rows[0].total).toBe(2);
});
