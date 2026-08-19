function inteiroPositivo(
  valor,
  padrao
) {
  const numero = Number(valor);

  return Number.isInteger(numero) &&
    numero > 0
    ? numero
    : padrao;
}

function obterConfiguracaoPool({
  env = process.env,
  production = false,
  test = false,
  proxyPublicoRailway = false,
} = {}) {
  return {
    max: inteiroPositivo(
      env.DB_POOL_MAX,
      proxyPublicoRailway ? 3 : 10
    ),

    connectionTimeoutMillis:
      inteiroPositivo(
        env.DB_CONNECTION_TIMEOUT,
        10000
      ),

    idleTimeoutMillis:
      inteiroPositivo(
        env.DB_IDLE_TIMEOUT,
        proxyPublicoRailway ? 5000 : 30000
      ),

    /*
     * Limites independentes impedem que uma consulta ou um lock
     * ocupe indefinidamente uma das poucas conexoes da aplicacao.
     * Em desenvolvimento continuam ativos para que travamentos
     * aparecam antes de chegar a producao.
     */
    statement_timeout:
      inteiroPositivo(
        env.DB_STATEMENT_TIMEOUT,
        production ? 15000 : 30000
      ),

    query_timeout:
      inteiroPositivo(
        env.DB_QUERY_TIMEOUT,
        production ? 20000 : 35000
      ),

    lock_timeout:
      inteiroPositivo(
        env.DB_LOCK_TIMEOUT,
        production ? 5000 : 10000
      ),

    idle_in_transaction_session_timeout:
      inteiroPositivo(
        env.DB_IDLE_TRANSACTION_TIMEOUT,
        production ? 15000 : 30000
      ),

    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    allowExitOnIdle: test,
  };
}

module.exports = {
  inteiroPositivo,
  obterConfiguracaoPool,
};
