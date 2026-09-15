const errorHandler = require("../src/middlewares/errorHandler");

describe("errorHandler - integridade do histórico", () => {
  function criarResposta() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  test("traduz serviço referenciado por agendamento para conflito orientando desativação", () => {
    const erro = new Error(
      "update or delete on table servicos_negocio violates foreign key constraint"
    );
    erro.code = "23503";
    erro.constraint = "agendamentos_servico_fk";

    const req = {
      id: "request-servico-historico",
      path: "/servicos/12",
      method: "DELETE",
    };
    const res = criarResposta();

    errorHandler(erro, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      erro:
        "Este serviço possui agendamentos no histórico. Desative-o para impedir novas reservas sem perder os registros existentes.",
      request_id: "request-servico-historico",
    });
  });

  test("traduz vínculo profissional-negócio removido durante o agendamento para conflito", () => {
    const erro = new Error(
      "Profissional não possui vínculo ativo com o negócio."
    );
    erro.code = "23503";
    erro.constraint = "agendamentos_profissional_negocio_vinculo";

    const req = {
      id: "request-vinculo-removido",
      path: "/agendamentos",
      method: "POST",
    };
    const res = criarResposta();

    errorHandler(erro, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      erro:
        "Esta profissional não está mais vinculada a este negócio. Atualize a página e escolha uma profissional disponível.",
      request_id: "request-vinculo-removido",
    });
  });

  test("não transforma qualquer violação de chave estrangeira em erro operacional", () => {
    const erro = new Error("foreign key violation");
    erro.code = "23503";
    erro.constraint = "outra_constraint_fk";

    const req = {
      id: "request-outra-fk",
      path: "/teste",
      method: "DELETE",
    };
    const res = criarResposta();

    errorHandler(erro, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      erro: "Erro interno do servidor.",
      request_id: "request-outra-fk",
    });
  });
});
