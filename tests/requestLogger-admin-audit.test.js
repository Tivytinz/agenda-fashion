const { EventEmitter } = require("node:events");
const requestLogger = require("../src/middlewares/requestLogger");
const registrador = require("../src/utils/registrador");

test.each([
  [{}, "RECENTES"],
  [{ resultado: "PENDENTE", pagina: "2" }, "PENDENTE"],
  [{ resultado: "REVISADA", limite: "25" }, "REVISADA"],
  [{ atorId: "12345" }, "ATOR"],
  [{ atorId: "12345", resultado: "PENDENTE" }, "OUTRO"],
  [{ resultado: "desconhecido", contato: "segredo" }, "OUTRO"]
])("classifica a consulta de auditoria sem expor filtros", (query, cenario) => {
  expect(requestLogger.classificarAuditoria({
    method: "GET", path: "/admin/auditoria", query
  })).toEqual({ rota: "/admin/auditoria", cenario });
});

test("normaliza a revisão e não registra o ID do caminho", () => {
  expect(requestLogger.classificarAuditoria({
    method: "POST", path: "/admin/auditoria/12345/revisao"
  })).toEqual({ rota: "/admin/auditoria/:id/revisao", cenario: "REVISAO" });
});

test("registra somente a categoria segura da auditoria", () => {
  const anterior = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const info = jest.spyOn(registrador, "informacao").mockImplementation(() => {});
  try {
    const req = {
      method: "GET", path: "/admin/auditoria",
      originalUrl: "/admin/auditoria?atorId=12345&contato=segredo",
      query: { atorId: "12345", contato: "segredo" }, id: "request-12345"
    };
    const res = new EventEmitter();
    res.statusCode = 200;
    requestLogger(req, res, jest.fn());
    res.emit("finish");
    const contexto = info.mock.calls[0][1];
    expect(contexto).toMatchObject({
      rota: "/admin/auditoria", auditoria_cenario: "OUTRO", status: 200
    });
    expect(JSON.stringify(contexto)).not.toMatch(/segredo|atorId=12345|contato/);
  } finally {
    info.mockRestore();
    if (anterior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = anterior;
  }
});
