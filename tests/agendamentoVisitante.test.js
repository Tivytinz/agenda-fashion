const {
  gerarAcessoVisitante,
  validarAcessoVisitante,
} = require("../src/utils/agendamentoVisitante");

describe("acesso seguro do agendamento visitante", () => {
  const segredoAnterior = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET =
      "segredo-de-teste-com-entropia-suficiente";
  });

  afterAll(() => {
    process.env.JWT_SECRET = segredoAnterior;
  });

  test("gera uma capability vinculada ao id e rejeita outro agendamento", () => {
    const acesso = gerarAcessoVisitante(101);

    expect(acesso).toMatch(
      /^[A-Za-z0-9_-]{43}$/
    );
    expect(
      validarAcessoVisitante(101, acesso)
    ).toBe(true);
    expect(
      validarAcessoVisitante(102, acesso)
    ).toBe(false);
  });

  test("rejeita capability ausente ou adulterada", () => {
    expect(
      validarAcessoVisitante(101, "")
    ).toBe(false);
    expect(
      validarAcessoVisitante(
        101,
        "x".repeat(43)
      )
    ).toBe(false);
  });
});
