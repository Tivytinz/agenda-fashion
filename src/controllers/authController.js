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

const {
  definirCookieSessao,
  limparCookieSessao,
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

  res.set(
    "Cache-Control",
    "no-store"
  );

  return res
    .status(status)
    .json(resultado);
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

    marketing:
      req.body?.marketing,
  };
}

/*
 * POST /cadastro
 *
 * Cria uma conta única.
 *
 * A conta ainda não é classificada como:
 * - cliente
 * - dono
 * - profissional
 *
 * Essas funções serão determinadas
 * pelo uso e pelos vínculos futuros.
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
  logout,
  configuracaoPublica,
};
