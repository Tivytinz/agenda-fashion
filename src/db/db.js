const { Pool } = require("pg");
const registrador = require("../utils/registrador");

const ambiente =
  process.env.NODE_ENV ||
  "development";

const isProduction =
  ambiente === "production";

const isTest =
  ambiente === "test";

const databaseUrl =
  String(
    process.env.DATABASE_URL ||
    ""
  ).trim();

if (!databaseUrl) {
  throw new Error(
    "A variável DATABASE_URL não foi configurada."
  );
}

/*
 * Quando o servidor está sendo executado
 * localmente, a conexão com o banco da
 * Railway normalmente passa pelo proxy público.
 */
const usandoProxyPublicoRailway =
  databaseUrl.includes(
    ".proxy.rlwy.net"
  );

function obterNumeroAmbiente(
  nome,
  valorPadrao
) {
  const valor =
    Number(
      process.env[nome]
    );

  if (
    Number.isFinite(valor) &&
    valor > 0
  ) {
    return valor;
  }

  return valorPadrao;
}

function ehErroTransitorio(
  erro
) {
  const codigo =
    String(
      erro?.code ||
      ""
    ).toUpperCase();

  const codigosTransitorios =
    new Set([
      "08000",
      "08001",
      "08003",
      "08004",
      "08006",
      "08P01",
      "57P01",
      "57P02",
      "57P03",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "EPIPE",
    ]);

  if (
    codigosTransitorios.has(
      codigo
    )
  ) {
    return true;
  }

  const mensagem =
    String(
      erro?.message ||
      ""
    ).toLowerCase();

  const mensagensTransitorias = [
    "connection terminated unexpectedly",
    "connection terminated",
    "server closed the connection unexpectedly",
    "connection timeout",
    "socket hang up",
    "read econnreset",
    "write epipe",
  ];

  return mensagensTransitorias.some(
    (trecho) =>
      mensagem.includes(
        trecho
      )
  );
}

function limparComentariosSql(
  texto
) {
  return String(
    texto ||
    ""
  )
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    )
    .replace(
      /--.*$/gm,
      ""
    )
    .trim();
}

function ehConsultaSomenteLeitura(
  texto
) {
  const consulta =
    limparComentariosSql(
      typeof texto === "object"
        ? texto?.text
        : texto
    );

  return /^(SELECT|SHOW|EXPLAIN|VALUES)\b/i
    .test(
      consulta
    );
}

function aguardar(
  milissegundos
) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milissegundos
      );
    }
  );
}

const pool =
  new Pool({
    connectionString:
      databaseUrl,

    ssl:
      isProduction
        ? {
            rejectUnauthorized:
              false,
          }
        : false,

    /*
     * No proxy público da Railway,
     * poucas conexões são suficientes
     * durante o desenvolvimento local.
     */
    max:
      obterNumeroAmbiente(
        "DB_POOL_MAX",
        usandoProxyPublicoRailway
          ? 3
          : 10
      ),

    connectionTimeoutMillis:
      obterNumeroAmbiente(
        "DB_CONNECTION_TIMEOUT",
        10000
      ),

    /*
     * Conexões locais ociosas são
     * descartadas mais rapidamente,
     * antes que o proxy as encerre.
     */
    idleTimeoutMillis:
      obterNumeroAmbiente(
        "DB_IDLE_TIMEOUT",
        usandoProxyPublicoRailway
          ? 5000
          : 30000
      ),

    keepAlive:
      true,

    keepAliveInitialDelayMillis:
      5000,

    /*
     * Permite que o Jest finalize
     * mesmo com conexões ociosas.
     */
    allowExitOnIdle:
      isTest,
  });

/*
 * Um único listener evita que o mesmo
 * encerramento seja registrado duas vezes.
 */
pool.on(
  "error",
  (erro) => {
    if (
      ehErroTransitorio(
        erro
      )
    ) {
      registrador.aviso(
        "PostgreSQL: uma conexão ociosa foi encerrada; o pool abrirá outra automaticamente.",
        erro?.code ||
        erro?.message
      );

      return;
    }

    registrador.erro(
      "Erro inesperado no pool do PostgreSQL:",
      erro
    );
  }
);

/*
 * Executa uma consulta comum.
 *
 * Consultas somente de leitura recebem
 * uma segunda tentativa quando ocorre
 * uma falha transitória de conexão.
 *
 * Operações de escrita não são repetidas,
 * evitando duplicar cadastros, pagamentos
 * ou agendamentos.
 */
async function query(
  texto,
  parametros
) {
  try {
    return await pool.query(
      texto,
      parametros
    );
  } catch (erro) {
    const podeTentarNovamente =
      !isTest &&
      ehConsultaSomenteLeitura(
        texto
      ) &&
      ehErroTransitorio(
        erro
      );

    if (
      !podeTentarNovamente
    ) {
      throw erro;
    }

    registrador.aviso(
      "PostgreSQL: conexão interrompida durante uma consulta de leitura. Tentando novamente..."
    );

    await aguardar(
      300
    );

    return pool.query(
      texto,
      parametros
    );
  }
}

/*
 * Obtém uma conexão exclusiva.
 *
 * A obtenção pode ser repetida uma vez,
 * pois nenhuma transação começou ainda.
 *
 * Quem utilizar essa função precisa
 * executar client.release() ao terminar.
 */
async function connect() {
  try {
    return await pool.connect();
  } catch (erro) {
    if (
      isTest ||
      !ehErroTransitorio(
        erro
      )
    ) {
      throw erro;
    }

    registrador.aviso(
      "PostgreSQL: falha temporária ao obter uma conexão. Tentando novamente..."
    );

    await aguardar(
      300
    );

    return pool.connect();
  }
}

/*
 * Executa operações dentro da mesma
 * conexão e transação.
 *
 * A transação não é repetida
 * automaticamente.
 */
async function executarTransacao(
  callback
) {
  if (
    typeof callback !==
    "function"
  ) {
    throw new TypeError(
      "A transação precisa receber uma função."
    );
  }

  const client =
    await connect();

  let transacaoIniciada =
    false;

  try {
    await client.query(
      "BEGIN"
    );

    transacaoIniciada =
      true;

    const resultado =
      await callback(
        client
      );

    await client.query(
      "COMMIT"
    );

    transacaoIniciada =
      false;

    return resultado;
  } catch (erro) {
    if (
      transacaoIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        erroRollback
      ) {
        registrador.erro(
          "Erro ao executar ROLLBACK:",
          erroRollback
        );
      }
    }

    throw erro;
  } finally {
    client.release();
  }
}

/*
 * Encerra todas as conexões.
 *
 * Utilizado principalmente nos testes
 * e no encerramento controlado.
 */
function end() {
  return pool.end();
}

module.exports = {
  query,
  connect,
  executarTransacao,
  end,
};
