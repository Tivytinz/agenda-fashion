jest.mock("../src/db/db", () => ({ query: jest.fn(), executarTransacao: jest.fn() }));
jest.mock("../src/services/bookingAnalyticsService", () => ({
  registrarBookingCompleted: jest.fn(), registrarBookingNoShow: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const db = require("../src/db/db");
const analytics = require("../src/services/bookingAnalyticsService");
const routes = require("../src/routes/agendaRoutes");
const errorHandler = require("../src/middlewares/errorHandler");
const service = require("../src/services/agendamentoLifecycleService");
const listService = require("../src/services/reservasProfissionaisRestritasService");
const repository = require("../src/repositories/reservasProfissionaisRestritasRepository");
const contexto = require("../src/repositories/agendaContextoRepository");
const lifecycle = require("../src/repositories/agendamentoLifecycleRepository");

const app = express();
app.use(express.json(), routes, errorHandler);
const token = () => jwt.sign({ id: 7 }, process.env.JWT_SECRET);
const booking = (overrides = {}) => ({
  id: 11, profissional_id: 7, negocio_id: 22, status: "confirmado",
  papel_executor: "profissional", vinculo_ativo: false,
  inicio_previsto_em: new Date(Date.now() - 3600000 * 2).toISOString(),
  duracao_minutos: 60, ...overrides,
});
const input = (status) => ({ usuarioId: 7, negocioId: 22, agendamentoId: 11, status });

beforeEach(() => {
  jest.clearAllMocks();
  db.executarTransacao.mockImplementation((callback) => callback({ query: db.query }));
  db.query.mockResolvedValue({ rows: [] });
});

test.each(["realizado", "falta"])("RN50: registra %s e repete de forma idempotente", async (status) => {
  db.query.mockResolvedValueOnce({ rows: [booking()] })
    .mockResolvedValueOnce({ rows: [{ id: 11, status }] });
  expect((await service.atualizarStatusAtendimento(input(status))).agendamento.status).toBe(status);
  expect(db.query.mock.calls[0][1]).toEqual([11, 22, 7, status]);
  const registrar = status === "realizado" ? analytics.registrarBookingCompleted : analytics.registrarBookingNoShow;
  expect(registrar).toHaveBeenCalledTimes(1);
  db.query.mockResolvedValueOnce({ rows: [booking({ status })] });
  await service.atualizarStatusAtendimento(input(status));
  expect(registrar).toHaveBeenCalledTimes(1);
  expect(db.query).toHaveBeenCalledTimes(3);
});

test.each([
  ["iniciado", {}, 403],
  ["realizado", { profissional_id: 8 }, 403],
  ["falta", { profissional_id: 8 }, 403],
  ["realizado", { status: "cancelado" }, 409],
  ["falta", { status: "realizado" }, 409],
  ["falta", { atendimento_iniciado_em: new Date() }, 409],
  ["realizado", { inicio_previsto_em: new Date(Date.now() + 3600000).toISOString() }, 409],
  ["falta", { inicio_previsto_em: new Date(Date.now() - 5 * 60000).toISOString() }, 409],
])("RN50: recusa %s com estado %j", async (status, overrides, code) => {
  db.query.mockResolvedValueOnce({ rows: [booking(overrides)] });
  await expect(service.atualizarStatusAtendimento(input(status))).rejects.toMatchObject({ statusCode: code });
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(analytics.registrarBookingCompleted).not.toHaveBeenCalled();
  expect(analytics.registrarBookingNoShow).not.toHaveBeenCalled();
});

test("revalida o vínculo dentro da transação antes de escrever", async () => {
  await expect(service.atualizarStatusAtendimento(input("realizado"))).rejects.toMatchObject({ statusCode: 404 });
  expect(db.executarTransacao).toHaveBeenCalledTimes(1);
  expect(db.query).toHaveBeenCalledTimes(1);
});

test("somente a rota de atendimento habilita a exceção para vínculo inativo", async () => {
  const spy = jest.spyOn(contexto, "buscarVinculoOperacionalDoAgendamento").mockResolvedValue(null);
  for (const [path, permitirInativo] of [["atendimento", true], ["cancelar-operacional", false], ["reagendar-operacional", false]]) {
    const result = await request(app).patch(`/agendamentos/11/${path}`)
      .set("Authorization", `Bearer ${token()}`).send({ status: "realizado", permitirInativo: true, usuarioId: 8, negocioId: 99 });
    expect(result.status).toBe(404);
    expect(spy).toHaveBeenLastCalledWith({ agendamentoId: 11, usuarioId: 7, permitirInativo });
  }
  spy.mockRestore();
});

test("consulta exige sessão e ignora IDs do navegador", async () => {
  expect((await request(app).get("/reservas-profissionais-existentes")).status).toBe(401);
  const spy = jest.spyOn(repository, "listar").mockResolvedValue([]);
  const result = await request(app).get("/reservas-profissionais-existentes?usuarioId=8&negocioId=99")
    .set("Authorization", `Bearer ${token()}`);
  expect(result.status).toBe(200);
  expect(spy).toHaveBeenCalledWith({ usuarioId: 7, limite: 21, offset: 0 });
  spy.mockRestore();
});

test("pagina a consulta sem expor a linha extra", async () => {
  db.query.mockResolvedValue({ rows: Array.from({ length: 21 }, (_, id) => ({ id })) });
  const result = await listService.listar({ usuarioId: 7, pagina: 2 });
  expect(result.agendamentos).toHaveLength(20);
  expect(result.tem_proxima).toBe(true);
  expect(db.query.mock.calls[0][1]).toEqual([7, 21, 20]);
});

test.each([0, -1, "abc", 1.5, 10001, ""])("recusa página inválida %s", async (pagina) => {
  await expect(listService.listar({ usuarioId: 7, pagina })).rejects.toMatchObject({ statusCode: 400 });
  expect(db.query).not.toHaveBeenCalled();
});

test("reserva restrita exige os mesmos predicados em consulta e mutação", async () => {
  await repository.listar({ usuarioId: 7, limite: 21, offset: 0 });
  await lifecycle.buscarAgendamentoOperacionalParaAtualizar({ agendamentoId: 11, usuarioId: 7, negocioId: 22, statusDestino: "falta" });
  const { VINCULO_RESTRITO_SQL } = require("../src/repositories/reservasProfissionaisRestritasSql");
  for (const [sql] of db.query.mock.calls) expect(sql).toContain(VINCULO_RESTRITO_SQL);
});
