require("dotenv").config();

const BASE_URL =
  String(
    process.env.TEST_API_URL ||
    process.env.API_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

function obterCredenciais() {
  const email =
    String(
      process.env.ADMIN_TEST_EMAIL || ""
    )
      .trim()
      .toLowerCase();

  const senha =
    String(
      process.env.ADMIN_TEST_SENHA || ""
    );

  if (!email) {
    throw new Error(
      "Defina ADMIN_TEST_EMAIL antes de executar o teste."
    );
  }

  if (!senha) {
    throw new Error(
      "Defina ADMIN_TEST_SENHA antes de executar o teste."
    );
  }

  return {
    email,
    senha,
  };
}

async function lerResposta(resposta) {
  const texto =
    await resposta.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return {
      resposta:
        texto,
    };
  }
}

async function requisitar(
  caminho,
  {
    method = "GET",
    token,
    body,
  } = {}
) {
  const headers = {
    Accept:
      "application/json",
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  if (
    body !== undefined
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  let resposta;

  try {
    resposta =
      await fetch(
        `${BASE_URL}${caminho}`,
        {
          method,
          headers,

          body:
            body === undefined
              ? undefined
              : JSON.stringify(
                  body
                ),
        }
      );
  } catch (erro) {
    throw new Error(
      `Não foi possível conectar em ${BASE_URL}. Confirme se o servidor está rodando. Motivo: ${erro.message}`
    );
  }

  const dados =
    await lerResposta(
      resposta
    );

  return {
    status:
      resposta.status,

    ok:
      resposta.ok,

    dados,
  };
}

async function fazerLogin({
  email,
  senha,
}) {
  const resultado =
    await requisitar(
      "/login",
      {
        method:
          "POST",

        body: {
          email,
          senha,
        },
      }
    );

  if (!resultado.ok) {
    throw new Error(
      `Login falhou com status ${resultado.status}: ${
        resultado.dados?.erro ||
        resultado.dados?.mensagem ||
        "resposta desconhecida"
      }`
    );
  }

  const token =
    resultado.dados?.token;

  if (!token) {
    throw new Error(
      "O login foi concluído, mas nenhum token foi retornado."
    );
  }

  return {
    token,

    usuario:
      resultado.dados?.usuario ||
      null,
  };
}

function resumirResposta(
  nome,
  resultado
) {
  const resumo = {
    rota:
      nome,

    status:
      resultado.status,

    sucesso:
      resultado.ok,
  };

  if (
    resultado.dados?.erro
  ) {
    resumo.erro =
      resultado.dados.erro;
  }

  if (
    Array.isArray(
      resultado.dados?.negocios
    )
  ) {
    resumo.negocios =
      resultado.dados
        .negocios.length;
  }

  if (
    Array.isArray(
      resultado.dados
        ?.agendamentos
    )
  ) {
    resumo.agendamentos =
      resultado.dados
        .agendamentos.length;
  }

  if (
    Array.isArray(
      resultado.dados
        ?.usuariosRecentes
    )
  ) {
    resumo.usuariosRecentes =
      resultado.dados
        .usuariosRecentes.length;
  }

  if (
    resultado.dados
      ?.totalNegocios !==
    undefined
  ) {
    resumo.totalNegocios =
      resultado.dados
        .totalNegocios;
  }

  return resumo;
}

async function executar() {
  const credenciais =
    obterCredenciais();

  console.log(
    `\nAPI testada: ${BASE_URL}`
  );

  console.log(
    `Conta: ${credenciais.email}\n`
  );

  const sessao =
    await fazerLogin(
      credenciais
    );

  console.log(
    "Login realizado com sucesso."
  );

  if (
    sessao.usuario
  ) {
    console.table([
      {
        id:
          sessao.usuario.id,

        nome:
          sessao.usuario.nome,

        email:
          sessao.usuario.email,
      },
    ]);
  }

  const rotas = [
    {
      nome:
        "Dashboard",

      caminho:
        "/admin/dashboard?periodo=7",
    },

    {
      nome:
        "Negócios",

      caminho:
        "/admin/negocios",
    },

    {
      nome:
        "Agendamentos",

      caminho:
        "/admin/agendamentos",
    },

    {
      nome:
        "Marketing",

      caminho:
        "/admin/marketing",
    },
  ];

  const resultados = [];

  for (
    const rota
    of rotas
  ) {
    const resultado =
      await requisitar(
        rota.caminho,
        {
          token:
            sessao.token,
        }
      );

    resultados.push(
      resumirResposta(
        rota.nome,
        resultado
      )
    );

    if (!resultado.ok) {
      console.error(
        `\nFalha em ${rota.caminho}:`
      );

      console.dir(
        resultado.dados,
        {
          depth:
            6,
        }
      );
    }
  }

  console.log(
    "\nResultado das rotas:"
  );

  console.table(
    resultados
  );

  const falhas =
    resultados.filter(
      (resultado) =>
        !resultado.sucesso
    );

  if (
    falhas.length > 0
  ) {
    throw new Error(
      `${falhas.length} rota(s) administrativa(s) falharam.`
    );
  }

  console.log(
    "\nTodas as rotas administrativas responderam com sucesso."
  );
}

executar().catch(
  (erro) => {
    console.error(
      "\nTeste administrativo interrompido:"
    );

    console.error(
      erro?.message ||
      erro
    );

    process.exitCode =
      1;
  }
);