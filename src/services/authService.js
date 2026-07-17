const bcrypt = require(
  "bcrypt"
);

const jwt = require(
  "jsonwebtoken"
);

const authRepository = require(
  "../repositories/authRepository"
);

const AppError = require(
  "../errors/AppError"
);

/*
 * Retorna o segredo usado para
 * assinar os tokens JWT.
 */
function obterJwtSecret() {
  const segredo =
    String(
      process.env.JWT_SECRET ||
        ""
    ).trim();

  if (!segredo) {
    throw new Error(
      "JWT_SECRET não configurado nas variáveis de ambiente."
    );
  }

  return segredo;
}

/*
 * Duração do token.
 *
 * Exemplo no .env:
 * JWT_EXPIRES_IN=90d
 */
function obterExpiracaoToken() {
  const expiracao =
    String(
      process.env.JWT_EXPIRES_IN ||
        "90d"
    ).trim();

  return expiracao || "90d";
}

/*
 * Custo utilizado pelo bcrypt.
 *
 * Valores aceitos:
 * 10 até 14.
 */
function obterBcryptRounds() {
  const rounds =
    Number(
      process.env.BCRYPT_ROUNDS
    );

  if (
    Number.isInteger(rounds) &&
    rounds >= 10 &&
    rounds <= 14
  ) {
    return rounds;
  }

  return 10;
}

function normalizarTexto(
  valor
) {
  return String(
    valor ?? ""
  ).trim();
}

function normalizarEmail(
  valor
) {
  return normalizarTexto(
    valor
  ).toLowerCase();
}

/*
 * Mantém somente números.
 *
 * Também remove o código do Brasil
 * quando vier como 55 + DDD + número.
 */
function normalizarWhatsapp(
  valor
) {
  let numeros =
    String(valor ?? "")
      .replace(/\D/g, "");

  if (
    (numeros.length === 12 ||
      numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    numeros =
      numeros.slice(2);
  }

  return numeros;
}

function emailValido(
  email
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

/*
 * Remove senha e outros campos
 * que não devem ser enviados.
 */
function sanitizarUsuario(
  usuario
) {
  return {
    id:
      usuario.id,

    nome:
      usuario.nome,

    email:
      usuario.email,

    whatsapp:
      usuario.whatsapp,

    ativo:
      usuario.ativo,

    email_verificado_em:
      usuario.email_verificado_em,

    ultimo_login_em:
      usuario.ultimo_login_em,

    senha_alterada_em:
      usuario.senha_alterada_em,

    created_at:
      usuario.created_at,

    updated_at:
      usuario.updated_at,
  };
}

function validarDadosCadastro({
  nome,
  email,
  senha,
  whatsapp,
}) {
  const nomeLimpo =
    normalizarTexto(nome);

  const emailLimpo =
    normalizarEmail(email);

  const senhaTexto =
    String(senha ?? "");

  const whatsappLimpo =
    normalizarWhatsapp(
      whatsapp
    );

  if (
    !nomeLimpo ||
    !emailLimpo ||
    !senhaTexto ||
    !whatsappLimpo
  ) {
    throw new AppError(
      "Preencha todos os campos obrigatórios.",
      400
    );
  }

  if (
    nomeLimpo.length < 2 ||
    nomeLimpo.length > 120
  ) {
    throw new AppError(
      "Digite um nome válido.",
      400
    );
  }

  if (
    emailLimpo.length > 160 ||
    !emailValido(emailLimpo)
  ) {
    throw new AppError(
      "Digite um email válido.",
      400
    );
  }

  if (
    ![10, 11].includes(
      whatsappLimpo.length
    )
  ) {
    throw new AppError(
      "Digite um WhatsApp válido.",
      400
    );
  }

  const tamanhoSenhaEmBytes =
    Buffer.byteLength(
      senhaTexto,
      "utf8"
    );

  if (
    tamanhoSenhaEmBytes < 6 ||
    tamanhoSenhaEmBytes > 72
  ) {
    throw new AppError(
      "A senha deve ter entre 6 e 72 bytes.",
      400
    );
  }

  return {
    nome:
      nomeLimpo,

    email:
      emailLimpo,

    senha:
      senhaTexto,

    whatsapp:
      whatsappLimpo,
  };
}

/*
 * O token identifica somente a conta.
 *
 * O papel de dono ou profissional
 * será consultado no banco depois.
 */
function gerarToken(
  usuario
) {
  if (!usuario?.id) {
    throw new Error(
      "Não foi possível gerar o token: usuário inválido."
    );
  }

  return jwt.sign(
    {
      id:
        usuario.id,
    },

    obterJwtSecret(),

    {
      expiresIn:
        obterExpiracaoToken(),
    }
  );
}

/*
 * POST /cadastro
 *
 * Cria uma conta única.
 */
async function cadastro({
  nome,
  email,
  senha,
  whatsapp,
}) {
  const dados =
    validarDadosCadastro({
      nome,
      email,
      senha,
      whatsapp,
    });

  const usuarioExistente =
    await authRepository
      .buscarUsuarioPorEmail(
        dados.email
      );

  if (usuarioExistente) {
    throw new AppError(
      "Email já cadastrado.",
      409
    );
  }

  const senhaHash =
    await bcrypt.hash(
      dados.senha,
      obterBcryptRounds()
    );

  let usuarioCriado;

  try {
    usuarioCriado =
      await authRepository
        .criarUsuario({
          nome:
            dados.nome,

          email:
            dados.email,

          senha:
            senhaHash,

          whatsapp:
            dados.whatsapp,
        });
  } catch (erro) {
    /*
     * Código do PostgreSQL para
     * violação de índice único.
     */
    if (
      erro?.code === "23505"
    ) {
      throw new AppError(
        "Email já cadastrado.",
        409
      );
    }

    throw erro;
  }

  const usuarioSeguro =
    sanitizarUsuario(
      usuarioCriado
    );

  return {
    mensagem:
      "Conta criada com sucesso.",

    token:
      gerarToken(
        usuarioSeguro
      ),

    usuario:
      usuarioSeguro,
  };
}

/*
 * POST /login
 *
 * Autentica qualquer conta.
 */
async function login({
  email,
  senha,
}) {
  if (!email || !senha) {
    throw new AppError(
      "Email e senha são obrigatórios.",
      400
    );
  }

  const emailLimpo =
    normalizarEmail(email);

  const senhaInformada =
    String(senha);

  if (
    !emailValido(
      emailLimpo
    )
  ) {
    throw new AppError(
      "Digite um email válido.",
      400
    );
  }

  const usuario =
    await authRepository
      .buscarUsuarioPorEmail(
        emailLimpo
      );

  /*
   * A mesma mensagem é usada para
   * e-mail inexistente e senha errada.
   *
   * Isso evita revelar quais e-mails
   * estão cadastrados.
   */
  if (!usuario) {
    throw new AppError(
      "Email ou senha inválidos.",
      401
    );
  }

  if (
    usuario.ativo === false
  ) {
    throw new AppError(
      "Esta conta está desativada.",
      403
    );
  }

  const senhaValida =
    await bcrypt.compare(
      senhaInformada,
      usuario.senha
    );

  if (!senhaValida) {
    throw new AppError(
      "Email ou senha inválidos.",
      401
    );
  }

  const loginAtualizado =
    await authRepository
      .atualizarUltimoLogin(
        usuario.id
      );

  const usuarioSeguro =
    sanitizarUsuario({
      ...usuario,

      ultimo_login_em:
        loginAtualizado
          ?.ultimo_login_em ||
        usuario.ultimo_login_em,
    });

  return {
    mensagem:
      "Login realizado com sucesso.",

    token:
      gerarToken(
        usuarioSeguro
      ),

    usuario:
      usuarioSeguro,
  };
}

module.exports = {
  cadastro,
  login,
};