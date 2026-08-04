const negocioService = require(
  "../services/negocioService"
);

/*
 * Retira somente os campos permitidos
 * do corpo da requisição.
 *
 * Campos extras enviados pelo navegador
 * não chegam ao service.
 */
function obterDadosCriacao(
  req
) {
  return {
    nome:
      req.body?.nome,

    descricao:
      req.body?.descricao,

    setor:
      req.body?.setor,

    especialidades:
      req.body?.especialidades ??
      req.body?.areas,

    /*
     * Aceita temporariamente os dois nomes
     * para manter compatibilidade com o
     * formulário antigo.
     */
    whatsapp:
      req.body?.whatsapp ??
      req.body?.whatsapp_negocio,

    cidade:
      req.body?.cidade,

    estado:
      req.body?.estado,

    bairro:
      req.body?.bairro,

    endereco:
      req.body?.endereco,

    numero:
      req.body?.numero,

    complemento:
      req.body?.complemento,

    cep:
      req.body?.cep,

    localizacao_url:
      req.body?.localizacao_url,

    latitude:
      req.body?.latitude,

    longitude:
      req.body?.longitude,

    fuso_horario:
      req.body?.fuso_horario,
  };
}

/*
 * POST /criar-negocio
 *
 * Cria o estabelecimento e vincula
 * a conta autenticada como dona.
 */
async function criarNegocio(
  req,
  res,
  next
) {
  try {
    const resultado =
      await negocioService.criar({
        usuarioId:
          req.user?.id,

        ...obterDadosCriacao(
          req
        ),
      });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * GET /meu-negocio
 *
 * Mantido temporariamente para
 * compatibilidade com páginas antigas.
 *
 * O contexto principal da autenticação
 * é obtido por GET /minha-sessao.
 */
async function buscarMeuNegocio(
  req,
  res,
  next
) {
  try {
    const resultado =
      await negocioService
        .buscarMeuNegocio(
          req.user?.id
        );

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * GET /buscar-negocios
 *
 * O service retorna indisponível
 * enquanto o antigo fluxo de entrada
 * direta estiver desativado.
 */
async function buscarNegocios(
  req,
  res,
  next
) {
  try {
    const resultado =
      await negocioService
        .buscarPorTermo(
          req.query?.termo
        );

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * POST /entrar-negocio
 *
 * A vinculação direta foi bloqueada.
 * Futuramente será substituída pelo
 * fluxo seguro de convites.
 */
async function entrarNoNegocio(
  req,
  res,
  next
) {
  try {
    const resultado =
      await negocioService
        .entrarNoNegocio({
          usuarioId:
            req.user?.id,

          negocioId:
            req.body?.negocio_id,
        });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  criarNegocio,
  buscarMeuNegocio,
  buscarNegocios,
  entrarNoNegocio,
};
