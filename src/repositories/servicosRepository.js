const db = require("../db/db");

async function bloquearCadastroServico(client, negocioId) {
  await client.query(
    `
    SELECT pg_advisory_xact_lock(
      hashtext('agenda_fashion_limite_servicos'),
      $1::integer
    )
    `,
    [Number(negocioId)]
  );
}

async function buscarPlanoDoNegocio(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT
      p.id,
      p.nome,
      p.slug,
      p.limite_servicos
    FROM negocios n
    INNER JOIN planos p
      ON p.id = n.plano_id
    WHERE n.id = $1
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function contarServicosAtivos(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT COUNT(*)::int AS total
    FROM servicos_negocio
    WHERE negocio_id = $1
      AND ativo = TRUE
    `,
    [negocioId]
  );

  return Number(result.rows[0]?.total || 0);
}

async function buscarNegocioUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id, un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(id, negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT *
    FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [id, negocioId]
  );

  return result.rows[0] || null;
}

async function listarServicos(negocioId) {
  const result = await db.query(
    `
    SELECT *
    FROM servicos_negocio
    WHERE negocio_id = $1
    ORDER BY nome
    `,
    [negocioId]
  );

  return result.rows;
}

async function criarServico(
  { negocioId, nome, descricao, valor, duracaoMinutos, categoria, ativo },
  executor = db
) {
  const result = await executor.query(
    `
    INSERT INTO servicos_negocio (
      negocio_id, nome, descricao, valor, duracao_minutos, categoria, ativo, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
    `,
    [negocioId, nome, descricao, valor, duracaoMinutos, categoria, ativo]
  );

  return result.rows[0];
}

async function editarServico(
  { id, negocioId, nome, descricao, valor, duracaoMinutos, categoria, ativo },
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE servicos_negocio
    SET nome = $1,
        descricao = $2,
        valor = $3,
        duracao_minutos = $4,
        categoria = $5,
        ativo = $6
    WHERE id = $7
      AND negocio_id = $8
    RETURNING *
    `,
    [nome, descricao, valor, duracaoMinutos, categoria, ativo, id, negocioId]
  );

  return result.rows[0] || null;
}

async function removerServico(
  { id, negocioId },
  executor = db
) {
  const result = await executor.query(
    `
    DELETE FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    RETURNING
      id,
      foto_public_id
    `,
    [id, negocioId]
  );

  return result.rows[0] || null;
}

async function despublicarSemServicoAtivo(
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE negocios n
      SET
        publicado = FALSE,
        updated_at = NOW()
      WHERE n.id = $1
        AND n.publicado = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM servicos_negocio s
          WHERE s.negocio_id = n.id
            AND s.ativo = TRUE
        )
      RETURNING n.id, n.publicado
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function atualizarFotoServico({ id, negocioId, fotoUrl, fotoPublicId }) {
  const result = await db.query(
    `
    UPDATE servicos_negocio
    SET foto_url = $1, foto_public_id = $2
    WHERE id = $3
      AND negocio_id = $4
    RETURNING *
    `,
    [fotoUrl, fotoPublicId, id, negocioId]
  );

  return result.rows[0] || null;
}

async function listarFotosServico(servicoId) {
  const result = await db.query(
    `
    SELECT id, servico_id, foto_url, foto_public_id, created_at
    FROM fotos_servico
    WHERE servico_id = $1
    ORDER BY id DESC
    `,
    [servicoId]
  );

  return result.rows;
}

async function adicionarFotoGaleriaServico({ servicoId, fotoUrl, fotoPublicId }) {
  const result = await db.query(
    `
    INSERT INTO fotos_servico (servico_id, foto_url, foto_public_id)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [servicoId, fotoUrl, fotoPublicId]
  );

  return result.rows[0];
}

async function removerFotoGaleriaServico({ fotoId, negocioId }) {
  const result = await db.query(
    `
    DELETE FROM fotos_servico fs
    USING servicos_negocio s
    WHERE fs.id = $1
      AND s.id = fs.servico_id
      AND s.negocio_id = $2
    RETURNING
      fs.id,
      fs.foto_public_id
    `,
    [fotoId, negocioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  bloquearCadastroServico,
  buscarPlanoDoNegocio,
  contarServicosAtivos,
  buscarNegocioUsuario,
  buscarNegocioDono,
  buscarServicoDoNegocio,
  listarServicos,
  criarServico,
  editarServico,
  removerServico,
  despublicarSemServicoAtivo,
  atualizarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  removerFotoGaleriaServico,
};
