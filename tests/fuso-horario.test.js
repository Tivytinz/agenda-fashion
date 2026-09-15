const {
  FUSO_HORARIO_PADRAO,
  fusoHorarioValido,
  resolverFusoHorario,
  obterDataHoraNoFuso,
} = require("../src/utils/fusoHorario");

describe("fuso horário do negócio", () => {
  test.each([
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Rio_Branco",
    "America/Noronha",
  ])("aceita IANA válido: %s", (fusoHorario) => {
    expect(fusoHorarioValido(fusoHorario)).toBe(true);
    expect(resolverFusoHorario(fusoHorario)).toBe(fusoHorario);
  });

  test("faz fallback seguro para São Paulo quando o valor persistido é inválido", () => {
    expect(fusoHorarioValido("Brasil/Fuso-Inexistente")).toBe(false);
    expect(resolverFusoHorario("Brasil/Fuso-Inexistente"))
      .toBe(FUSO_HORARIO_PADRAO);
    expect(resolverFusoHorario(null)).toBe(FUSO_HORARIO_PADRAO);
  });

  test("calcula a data local conforme o fuso do negócio", () => {
    const instante = new Date("2026-09-15T02:30:00.000Z");

    expect(
      obterDataHoraNoFuso("America/Sao_Paulo", instante)
    ).toMatchObject({
      data: "2026-09-14",
      hora: "23:30",
    });

    expect(
      obterDataHoraNoFuso("America/Noronha", instante)
    ).toMatchObject({
      data: "2026-09-15",
      hora: "00:30",
    });

    expect(
      obterDataHoraNoFuso("America/Manaus", instante)
    ).toMatchObject({
      data: "2026-09-14",
      hora: "22:30",
    });
  });
});
