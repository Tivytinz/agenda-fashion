const {
  obterBcryptRounds,
} = require(
  "../src/config/passwordHash"
);

describe(
  "configuração de hash de senha",
  () => {
    test.each([
      ["10", 10],
      ["12", 12],
      ["14", 14],
    ])(
      "aceita BCRYPT_ROUNDS=%s",
      (valor, esperado) => {
        expect(
          obterBcryptRounds({
            BCRYPT_ROUNDS:
              valor,
          })
        ).toBe(
          esperado
        );
      }
    );

    test.each([
      [undefined],
      [""],
      ["9"],
      ["15"],
      ["abc"],
    ])(
      "usa 10 quando BCRYPT_ROUNDS=%s não é válido",
      (valor) => {
        expect(
          obterBcryptRounds({
            BCRYPT_ROUNDS:
              valor,
          })
        ).toBe(10);
      }
    );
  }
);
