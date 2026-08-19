const {
  inteiroPositivo,
  obterConfiguracaoPool,
} = require(
  "../src/config/databasePool"
);

describe("configuracao do pool PostgreSQL", () => {
  test("usa limites seguros em producao", () => {
    expect(
      obterConfiguracaoPool({
        env: {},
        production: true,
      })
    ).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
      query_timeout: 20000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout:
        15000,
    });
  });

  test("aceita somente inteiros positivos", () => {
    expect(inteiroPositivo("25", 10))
      .toBe(25);
    expect(inteiroPositivo("0", 10))
      .toBe(10);
    expect(inteiroPositivo("1.5", 10))
      .toBe(10);
    expect(inteiroPositivo("invalido", 10))
      .toBe(10);
  });

  test("respeita configuracao explicita", () => {
    expect(
      obterConfiguracaoPool({
        env: {
          DB_POOL_MAX: "20",
          DB_STATEMENT_TIMEOUT: "9000",
          DB_QUERY_TIMEOUT: "11000",
          DB_LOCK_TIMEOUT: "3000",
          DB_IDLE_TRANSACTION_TIMEOUT:
            "8000",
        },
        test: true,
      })
    ).toMatchObject({
      max: 20,
      statement_timeout: 9000,
      query_timeout: 11000,
      lock_timeout: 3000,
      idle_in_transaction_session_timeout:
        8000,
      allowExitOnIdle: true,
    });
  });
});
