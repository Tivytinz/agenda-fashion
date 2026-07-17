const authService = require(
  "../services/authService"
);

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
    const resultado =
      await authService.cadastro(
        obterDadosCadastro(req)
      );

    return res
      .status(201)
      .json(resultado);
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

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  cadastro,
  login,
};