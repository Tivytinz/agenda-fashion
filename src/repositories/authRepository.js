const db = require(
  "../db/db"
);

/*
 * Busca a conta pelo e-mail.
 *
 * O LOWER protege contra diferenças
 * entre letras maiúsculas e minúsculas.
 */
async function buscarUsuarioPorEmail(
  email
) {
  const resultado =
    await db.query(
      `
      SELECT
        id,
        nome,
        email,
        senha,
        whatsapp,
        ativo,
        email_verificado_em,
        ultimo_login_em,
        senha_alterada_em,
        created_at,
        updated_at
      FROM usuarios
      WHERE LOWER(email) =
        LOWER($1)
      LIMIT 1
      `,
      [email]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Busca a conta pelo ID.
 *
 * Pode ser utilizada posteriormente
 * por rotas autenticadas como:
 *
 * GET /minha-conta
 */
async function buscarUsuarioPorId(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      SELECT
        id,
        nome,
        email,
        whatsapp,
        ativo,
        email_verificado_em,
        ultimo_login_em,
        senha_alterada_em,
        created_at,
        updated_at
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Cria uma conta única.
 *
 * Não existe mais tipo de usuário
 * nesta tabela.
 *
 * A senha recebida já deve estar
 * criptografada pelo authService.
 */
async function criarUsuario({
  nome,
  email,
  senha,
  whatsapp,
}) {
  const resultado =
    await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        whatsapp
      )
      VALUES (
        $1,
        $2,
        $3,
        $4
      )
      RETURNING
        id,
        nome,
        email,
        whatsapp,
        ativo,
        email_verificado_em,
        ultimo_login_em,
        senha_alterada_em,
        created_at,
        updated_at
      `,
      [
        nome,
        email,
        senha,
        whatsapp,
      ]
    );

  return resultado.rows[0];
}

/*
 * Registra o último login da conta.
 */
async function atualizarUltimoLogin(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET ultimo_login_em = NOW()
      WHERE id = $1
      RETURNING
        ultimo_login_em
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Atualiza a senha da conta.
 *
 * Será utilizada posteriormente no
 * fluxo de recuperação de senha.
 */
async function atualizarSenha({
  usuarioId,
  senha,
}) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET
        senha = $2,
        senha_alterada_em = NOW()
      WHERE id = $1
      RETURNING
        id,
        senha_alterada_em
      `,
      [
        usuarioId,
        senha,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Desativa uma conta sem excluir
 * os dados históricos relacionados.
 */
async function desativarUsuario(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET ativo = FALSE
      WHERE id = $1
      RETURNING
        id,
        ativo
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

module.exports = {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  criarUsuario,
  atualizarUltimoLogin,
  atualizarSenha,
  desativarUsuario,
};