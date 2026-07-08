const db = require("../db/db");

async function buscarNegocioUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT negocio_id, papel
    FROM usuarios_negocios
    WHERE usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT negocio_id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND papel = 'dono'
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(id, negocioId) {
  const result = await db.query(
    `
    SELECT id
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

async function criarServico({ negocioId, nome, valor, duracaoMinutos }) {
  const result = await db.query(
    `
    INSERT INTO servicos_negocio (
      negocio_id, nome, valor, duracao_minutos, ativo, created_at
    )
    VALUES ($1, $2, $3, $4, true, NOW())
    RETURNING *
    `,
    [negocioId, nome, valor, duracaoMinutos]
  );

  return result.rows[0];
}

async function editarServico({ id, negocioId, nome, valor, duracaoMinutos }) {
  const result = await db.query(
    `
    UPDATE servicos_negocio
    SET nome = $1, valor = $2, duracao_minutos = $3
    WHERE id = $4
      AND negocio_id = $5
    RETURNING *
    `,
    [nome, valor, duracaoMinutos, id, negocioId]
  );

  return result.rows[0] || null;
}

async function removerServico({ id, negocioId }) {
  const result = await db.query(
    `
    DELETE FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    RETURNING id
    `,
    [id, negocioId]
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
    RETURNING fs.id
    `,
    [fotoId, negocioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarNegocioUsuario,
  buscarNegocioDono,
  buscarServicoDoNegocio,
  listarServicos,
  criarServico,
  editarServico,
  removerServico,
  atualizarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  removerFotoGaleriaServico,
};