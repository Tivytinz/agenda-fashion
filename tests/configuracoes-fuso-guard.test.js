jest.mock("../src/db/db", () => ({ executarTransacao: jest.fn() }));
jest.mock("../src/repositories/servicosRepository", () => ({
  bloquearContextoDono: jest.fn().mockResolvedValue({ negocio_id: 11 }),
  sincronizarPublicacaoAutomatica: jest.fn()
}));

const db = require("../src/db/db");
const repo = require("../src/repositories/configuracoesRepository");

test("bloqueia troca de fuso com reserva futura antes do UPDATE e faz rollback", async () => {
  const query = jest.fn(async (sql) => {
    if (sql.includes("SELECT slug, fuso_horario")) {
      return { rows: [{ slug: "studio", fuso_horario: "America/Sao_Paulo" }] };
    }
    if (sql.includes("FROM agendamentos")) return { rows: [{ id: 1 }] };
    return { rows: [] };
  });
  db.executarTransacao.mockImplementationOnce(callback => callback({ query }));
  await expect(repo.atualizarNegocio(11, {
    slug: "studio", fuso_horario: "America/Manaus"
  }, 7)).rejects.toMatchObject({ code: "NEGOCIO_FUSO_RESERVAS_ATIVAS" });
  expect(query.mock.calls.some(([sql]) => /UPDATE negocios/.test(sql))).toBe(false);
  expect(query.mock.calls.some(([sql]) => /status IN \('agendado', 'confirmado'\)/.test(sql))).toBe(true);
});
