const registrador = require(
  "../src/utils/registrador"
);

describe("Registro de mensagens do terminal", () => {
  const nivelOriginal = process.env.LOG_LEVEL;
  const ambienteOriginal =
    process.env.NODE_ENV;
  const depuracaoOriginal =
    process.env.DEBUG_TEST_LOGS;

  afterEach(() => {
    if (nivelOriginal === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = nivelOriginal;
    }

    if (ambienteOriginal === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV =
        ambienteOriginal;
    }

    if (depuracaoOriginal === undefined) {
      delete process.env.DEBUG_TEST_LOGS;
    } else {
      process.env.DEBUG_TEST_LOGS =
        depuracaoOriginal;
    }

    jest.restoreAllMocks();
  });

  test("não polui o terminal durante os testes", () => {
    delete process.env.DEBUG_TEST_LOGS;

    const erro = jest
      .spyOn(console, "error")
      .mockImplementation();
    const aviso = jest
      .spyOn(console, "warn")
      .mockImplementation();
    const informacao = jest
      .spyOn(console, "info")
      .mockImplementation();

    registrador.erro("falha simulada");
    registrador.aviso("aviso simulado");
    registrador.informacao("informação simulada");

    expect(erro).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
    expect(informacao).not.toHaveBeenCalled();
  });

  test("permite reativar as mensagens para investigar testes", () => {
    process.env.DEBUG_TEST_LOGS = "true";
    process.env.LOG_LEVEL = "informacao";

    const informacao = jest
      .spyOn(console, "info")
      .mockImplementation();

    registrador.informacao("teste detalhado", {
      codigo: 1,
    });

    expect(informacao).toHaveBeenCalledWith(
      "[INFORMAÇÃO] teste detalhado",
      { codigo: 1 }
    );
  });

  test("respeita o nível de mensagens configurado", () => {
    process.env.DEBUG_TEST_LOGS = "true";
    process.env.LOG_LEVEL = "erro";

    const erro = jest
      .spyOn(console, "error")
      .mockImplementation();
    const aviso = jest
      .spyOn(console, "warn")
      .mockImplementation();

    registrador.aviso("não deve aparecer");
    registrador.erro("deve aparecer");

    expect(aviso).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalledWith(
      "[ERRO] deve aparecer"
    );
  });

  test("gera JSON pesquisavel em producao", () => {
    process.env.NODE_ENV =
      "production";
    process.env.LOG_LEVEL =
      "informacao";

    const informacao = jest
      .spyOn(console, "info")
      .mockImplementation();

    registrador.informacao(
      "Requisicao concluida.",
      {
        id_requisicao: "req-12345678",
        status: 200,
      }
    );

    expect(informacao)
      .toHaveBeenCalledTimes(1);

    const registro = JSON.parse(
      informacao.mock.calls[0][0]
    );

    expect(registro).toMatchObject({
      nivel: "informacao",
      mensagem: "Requisicao concluida.",
      id_requisicao: "req-12345678",
      status: 200,
    });
    expect(registro.timestamp)
      .toEqual(expect.any(String));
  });

  test("serializa erros sem perder a mensagem", () => {
    process.env.NODE_ENV =
      "production";
    process.env.LOG_LEVEL =
      "erro";

    const erroConsole = jest
      .spyOn(console, "error")
      .mockImplementation();
    const erro = new Error(
      "Falha de conexao"
    );
    erro.code = "ECONNRESET";

    registrador.erro(
      "Banco indisponivel.",
      erro
    );

    const registro = JSON.parse(
      erroConsole.mock.calls[0][0]
    );

    expect(registro).toMatchObject({
      erro_nome: "Error",
      erro_mensagem: "Falha de conexao",
      erro_codigo: "ECONNRESET",
    });
  });
});
