const db = require("../db/db");

async function buscarPorSlug(slug) {
  const result = await db.query(
    `
    SELECT *
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function usuarioPossuiNegocio(usuarioId) {
  const result = await db.query(
    `
    SELECT 1
    FROM usuarios_negocios
    WHERE usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows.length > 0;
}

async function criar({
  nome,
  slug,
  donoUsuarioId,
  planoId,
  asaasCustomerId
}) {
  const result = await db.query(
    `
    INSERT INTO negocios (
      nome,
      slug,
      dono_usuario_id,
      plano_id,
      asaas_customer_id,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,NOW())
    RETURNING *
    `,
    [
      nome,
      slug,
      donoUsuarioId,
      planoId,
      asaasCustomerId
    ]
  );

  return result.rows[0];
}

async function vincularUsuario(
  usuarioId,
  negocioId,
  papel = "dono"
) {
  await db.query(
    `
    INSERT INTO usuarios_negocios (
      usuario_id,
      negocio_id,
      papel
    )
    VALUES ($1,$2,$3)
    `,
    [
      usuarioId,
      negocioId,
      papel
    ]
  );
}

async function buscarDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT
      n.*
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function listarProfissionais(negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      u.email,
      u.whatsapp,
      u.tipo,
      u.foto_url,
      un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.negocio_id = $1
    ORDER BY
      CASE
        WHEN un.papel = 'dono' THEN 1
        ELSE 2
      END,
      u.nome
    `,
    [negocioId]
  );

  return result.rows;
}

async function atualizarAssinaturaAsaas({
  negocioId,
  subscriptionId,
  status,
  proximoVencimento
}) {
  const result = await db.query(
    `
    UPDATE negocios
    SET
      asaas_subscription_id = $1,
      status_assinatura = $2,
      proximo_vencimento = $3
    WHERE id = $4
    RETURNING *
    `,
    [
      subscriptionId,
      status,
      proximoVencimento,
      negocioId
    ]
  );

  return result.rows[0];
}

async function atualizarPlano(negocioId, planoId) {
    const result = await db.query(
        `
        UPDATE negocios
        SET
            plano_id = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [planoId, negocioId]
    );

    return result.rows[0] || null;
}

async function gerarSlugDisponivel(baseSlug) {
  let slug = baseSlug;
  let contador = 1;

  while (true) {
    const existente = await buscarPorSlug(slug);

    if (!existente) {
      return slug;
    }

    slug = `${baseSlug}-${contador}`;
    contador++;
  }
}

module.exports = {
  buscarPorSlug,
  gerarSlugDisponivel,
  usuarioPossuiNegocio,
  criar,
  vincularUsuario,
  buscarDoUsuario,
  listarProfissionais,
  atualizarAssinaturaAsaas,
  atualizarPlano
};