const bcrypt = require(
  "bcrypt"
);

const jwt = require(
  "jsonwebtoken"
);

const authRepository = require(
  "../repositories/authRepository"
);

const googleIdentityService =
  require(
    "./googleIdentityService"
  );

const marketingUserAttributionService =
  require(
    "./marketingUserAttributionService"
  );

const registrador = require(
  "../utils/registrador"
);

const AppError = require(
  "../errors/AppError"
);

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

function obterExpiracaoToken() {
  const expiracao =
    String(
      process.env.JWT_EXPIRES_IN ||
        "7d"
    ).trim();

  return expiracao || "7d";
}

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
    aceita_notificacoes_whatsapp:
      usuario.aceita_notificacoes_whatsapp === true,
    ativo:
      usuario.ativo,
    googleConectado:
      Boolean(usuario.google_sub),
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
    tamanhoSenhaEmBytes < 8 ||
    tamanhoSenhaEmBytes > 72
  ) {
    throw new AppError(
      "A senha deve ter entre 8 e 72 bytes.",
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

function montarResultado({
  usuario,
  mensagem,
  contaCriada = false,
}) {
  const usuarioSeguro =
    sanitizarUsuario(usuario);

  return {
    mensagem,
    token:
      gerarToken(usuarioSeguro),
    usuario: usuarioSeguro,
    contaCriada,
  };
}

async function registrarAtribuicaoCriacao(
  usuarioId,
  marketing
) {
  if (!marketing) {
    return;
  }

  try {
    await marketingUserAttributionService
      .registrarContaCriada({
        usuarioId,
        marketing,
      });
  } catch (erro) {
    registrador.aviso(
      "[Marketing] Não foi possível registrar a atribuição da conta criada.",
      {
        usuario_id:
          usuarioId,
        erro:
          erro?.message,
      }
    );
  }
}

async function cadastro({
  nome,
  email,
  senha,
  whatsapp,
  aceitaAlertasWhatsapp = false,
  aceitaLembretesWhatsapp = false,
  aceitaNotificacoesWhatsapp = false,
  marketing,
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
          aceitaAlertasWhatsapp:
            aceitaAlertasWhatsapp === true,
          aceitaLembretesWhatsapp:
            aceitaLembretesWhatsapp === true,
          aceitaNotificacoesWhatsapp:
            aceitaNotificacoesWhatsapp === true,
        });
  } catch (erro) {
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

  await registrarAtribuicaoCriacao(
    usuarioCriado.id,
    marketing
  );

  return montarResultado({
    usuario: usuarioCriado,
    mensagem:
      "Conta criada com sucesso.",
    contaCriada: true,
  });
}

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

  if (!usuario.senha) {
    throw new AppError(
      "Esta conta usa o login com Google.",
      401
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

  return montarResultado({
    usuario: {
      ...usuario,
      ultimo_login_em:
        loginAtualizado
          ?.ultimo_login_em ||
        usuario.ultimo_login_em,
    },
    mensagem:
      "Login realizado com sucesso.",
  });
}

async function buscarContaGoogle({
  googleSub,
  email,
  emailAutoritativo,
}) {
  let usuario =
    await authRepository
      .buscarUsuarioPorGoogleSub(
        googleSub
      );

  if (usuario) {
    return usuario;
  }

  usuario =
    await authRepository
      .buscarUsuarioPorEmail(
        email
      );

  if (
    usuario?.google_sub &&
    usuario.google_sub !==
      googleSub
  ) {
    throw new AppError(
      "Este e-mail já está vinculado a outra conta Google.",
      409
    );
  }

  if (
    usuario &&
    !usuario.google_sub
  ) {
    if (!emailAutoritativo) {
      throw new AppError(
        "Entre com sua senha para vincular este e-mail à conta Google.",
        409
      );
    }

    usuario =
      await authRepository
        .vincularUsuarioAoGoogle({
          usuarioId:
            usuario.id,
          googleSub,
        });

    if (!usuario) {
      throw new AppError(
        "Não foi possível vincular sua conta Google.",
        409
      );
    }
  }

  return usuario;
}

async function loginGoogle({
  credencial,
  marketing,
  aceitaNotificacoesWhatsapp = false,
}) {
  const identidade =
    await googleIdentityService
      .verificarCredencial(
        credencial
      );

  let usuario =
    await buscarContaGoogle(
      identidade
    );
  let contaCriada = false;

  if (!usuario) {
    try {
      usuario =
        await authRepository
          .criarUsuarioGoogle(
            {
              ...identidade,
              aceitaNotificacoesWhatsapp:
                aceitaNotificacoesWhatsapp === true,
            }
          );
      contaCriada = true;
    } catch (erro) {
      if (erro?.code !== "23505") {
        throw erro;
      }

      usuario =
        await buscarContaGoogle(
          identidade
        );

      if (!usuario) {
        throw new AppError(
          "Não foi possível criar sua conta Google.",
          409
        );
      }
    }
  }

  if (usuario.ativo === false) {
    throw new AppError(
      "Esta conta está desativada.",
      403
    );
  }

  const loginAtualizado =
    await authRepository
      .atualizarUltimoLogin(
        usuario.id
      );

  if (contaCriada) {
    await registrarAtribuicaoCriacao(
      usuario.id,
      marketing
    );
  }

  return montarResultado({
    usuario: {
      ...usuario,
      ultimo_login_em:
        loginAtualizado
          ?.ultimo_login_em ||
        usuario.ultimo_login_em,
    },
    mensagem: contaCriada
      ? "Conta criada com Google."
      : "Login com Google realizado com sucesso.",
    contaCriada,
  });
}

module.exports = {
  cadastro,
  login,
  loginGoogle,
};
