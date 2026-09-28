const authService = require(
  "../services/authService"
);

const googleIdentityService =
  require(
    "../services/googleIdentityService"
  );

const metaAdsService = require(
  "../services/metaAdsService"
);

const passwordResetService = require(
  "../services/passwordResetService"
);

const authSessionRepository = require(
  "../repositories/authSessionRepository"
);
const {
  hashToken,
  verificarToken,
} = require(
  "../utils/sessionToken"
);
const {
  tokenAnteriorATrocaDeSenha,
} = require(
  "../middlewares/auth"
);

const {
  definirCookieSessao,
  limparCookieSessao,
  obterTokenBearer,
  obterTokenCookie,
} = require(
  "../config/sessionCookie"
);

function responderAutenticacao(
  res,
  status,
  resultado
) {
  definirCookieSessao(
    res,
    resultado.token
  );

  const resposta = {
    ...resultado,
  };

  delete resposta.token;

  res.set(
    "Cache-Control",
    "no-store"
  );

  return res
    .status(status)
    .json(resposta);
}

/*
 * Retira somente os campos permitidos
 * do corpo da requisição.
 *
 * Campos extras enviados pelo navegador
 * não são repassados ao service.
 */
function obterDadosCadastro(req) {
  return {
    nome:
      req.body?.nome,

    email:
      req.body?.email,

    whatsapp:
      req.body?.whatsapp,

    senha:
      req.body?.senha,

    aceitaLembretesWhatsapp:
      req.body?.aceitaLembretesWhatsapp,

    aceitaNotificacoesWhatsapp:
      req.body?.aceitaNotificacoesWhatsapp,
    aceitaAlertasWhatsapp:
      req.body?.aceitaAlertasWhatsapp,

    marketing:
      req.body?.marketing,

    ativarPerfilProfissional:
      req.body?.perfil_profissional === true,
  };
}

/*
 * POST /cadastro
 *
 * Cria uma conta única.
 *
 * O perfil profissional é uma capacidade da mesma
 * identidade e pode ser ativado explicitamente no
 * cadastro sem criar uma segunda conta.
 */
async function cadastro(
  req,
  res,
  next
) {
  try {
    const dados =
      obterDadosCadastro(req);

    const resultado =
      await authService.cadastro(
        dados
      );

    if (resultado.contaCriada) {
      await metaAdsService
        .salvarConsentimentoSeguro({
          usuarioId:
            resultado.usuario?.id,
          meta:
            req.body?.meta
        });

      metaAdsService
        .enviarCadastroProfissionalSeguro({
          usuario:
            resultado.usuario,
          marketing:
            dados.marketing,
          contexto:
            metaAdsService
              .criarContextoRequisicao(
                req,
                req.body?.meta
              )
        });
    }

    return responderAutenticacao(
      res,
      201,
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

/*
 * POST /login
 *
 * Autentica qualquer conta.
 */
async function login(
  req,
  res,
  next
) {
  try {
    const resultado =
      await authService.login({
        email:
          req.body?.email,

        senha:
          req.body?.senha,
      });

    return responderAutenticacao(
      res,
      200,
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function loginGoogle(
  req,
  res,
  next
) {
  try {
    const marketing =
      req.body?.marketing;

    const resultado =
      await authService
        .loginGoogle({
          credencial:
            req.body?.credential,

          marketing,

          aceitaNotificacoesWhatsapp:
            req.body?.aceitaNotificacoesWhatsapp,

          ativarPerfilProfissional:
            req.body?.perfil_profissional === true,
        });

    if (resultado.contaCriada) {
      await metaAdsService
        .salvarConsentimentoSeguro({
          usuarioId:
            resultado.usuario?.id,
          meta:
            req.body?.meta
        });

      metaAdsService
        .enviarCadastroProfissionalSeguro({
          usuario:
            resultado.usuario,
          marketing,
          contexto:
            metaAdsService
              .criarContextoRequisicao(
                req,
                req.body?.meta
              )
        });
    }

    return responderAutenticacao(
      res,
      200,
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function esqueciSenha(
  req,
  res,
  next
) {
  try {
    const resultado = await passwordResetService.solicitarRedefinicao({
      email: req.body?.email,
    });

    res.set("Cache-Control", "no-store");
    return res.status(200).json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function redefinirSenha(
  req,
  res,
  next
) {
  try {
    const resultado = await passwordResetService.redefinirSenha({
      token: req.body?.token,
      senha: req.body?.senha,
    });

    limparCookieSessao(res);
    res.set("Cache-Control", "no-store");
    return res.status(200).json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function cookieSessaoEstaValido(
  token
) {
  let decoded;

  try {
    decoded =
      verificarToken(token);
  } catch (erro) {
    if (
      [
        "TokenExpiredError",
        "JsonWebTokenError",
        "NotBeforeError",
      ].includes(
        erro.name
      )
    ) {
      return false;
    }

    throw erro;
  }

  if (!decoded?.id) {
    return false;
  }

  const estadoDaSessao =
    await authSessionRepository
      .buscarEstadoDaSessao(
        decoded.id,
        hashToken(token)
      );

  return Boolean(
    estadoDaSessao
    && Number(
      estadoDaSessao.id
    ) === Number(
      decoded.id
    )
    && estadoDaSessao.ativo === true
    && estadoDaSessao
      .token_revogado !== true
    && !tokenAnteriorATrocaDeSenha(
      decoded,
      estadoDaSessao
        .senha_alterada_em
    )
  );
}

async function migrarSessaoLegada(
  req,
  res,
  next
) {
  try {
    const tokenCookie =
      obterTokenCookie(
        req.headers.cookie
      );

    res.set(
      "Cache-Control",
      "no-store"
    );

    // Cookie HttpOnly válido é a autoridade. Um cookie inválido não pode
    // impedir que um Bearer legado já autenticado conclua a migração.
    if (tokenCookie) {
      if (
        await cookieSessaoEstaValido(
          tokenCookie
        )
      ) {
        return res
          .status(200)
          .json({
            codigo:
              "COOKIE_SESSAO_PRESENTE",
            migrado: false,
            mensagem:
              "Uma sessão em cookie já existe e deve ser preservada.",
          });
      }

      limparCookieSessao(res);
    }

    const tokenLegado =
      obterTokenBearer(
        req.headers.authorization
      );

    if (tokenLegado) {
      definirCookieSessao(
        res,
        tokenLegado
      );
    }

    return res
      .status(204)
      .end();
  } catch (erro) {
    return next(erro);
  }
}

function logout(
  _req,
  res
) {
  limparCookieSessao(res);

  res.set(
    "Cache-Control",
    "no-store"
  );

  return res
    .status(204)
    .end();
}

function configuracaoPublica(
  _req,
  res,
  next
) {
  try {
    return res.status(200).json(
      googleIdentityService
        .obterConfiguracaoPublica()
    );
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  cadastro,
  login,
  loginGoogle,
  esqueciSenha,
  redefinirSenha,
  migrarSessaoLegada,
  logout,
  configuracaoPublica,
};
