const {
  OAuth2Client,
} = require("google-auth-library");

const AppError = require(
  "../errors/AppError"
);

let clienteGoogle;

function obterClientId() {
  const clientId = String(
    process.env.GOOGLE_CLIENT_ID ||
      ""
  ).trim();

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID não configurado nas variáveis de ambiente."
    );
  }

  return clientId;
}

function obterClienteGoogle() {
  if (!clienteGoogle) {
    clienteGoogle =
      new OAuth2Client();
  }

  return clienteGoogle;
}

async function verificarCredencial(
  credencial
) {
  const idToken = String(
    credencial || ""
  ).trim();

  if (!idToken) {
    throw new AppError(
      "A credencial do Google é obrigatória.",
      400
    );
  }

  let payload;

  try {
    const ticket =
      await obterClienteGoogle()
        .verifyIdToken({
          idToken,
          audience:
            obterClientId(),
        });

    payload =
      ticket.getPayload();
  } catch (erro) {
    throw new AppError(
      "Não foi possível validar sua conta Google.",
      401
    );
  }

  const googleSub = String(
    payload?.sub || ""
  ).trim();

  const email = String(
    payload?.email || ""
  )
    .trim()
    .toLowerCase();

  const nome = String(
    payload?.name || ""
  )
    .trim()
    .replace(/\s+/g, " ");

  if (
    !googleSub ||
    !email ||
    payload?.email_verified !== true
  ) {
    throw new AppError(
      "Sua conta Google precisa ter um e-mail verificado.",
      401
    );
  }

  return {
    googleSub,
    email,
    nome:
      nome ||
      email.split("@")[0],
    emailAutoritativo:
      email.endsWith(
        "@gmail.com"
      ) ||
      Boolean(payload?.hd),
  };
}

function obterConfiguracaoPublica() {
  return {
    googleClientId:
      obterClientId(),
  };
}

module.exports = {
  verificarCredencial,
  obterConfiguracaoPublica,
};
