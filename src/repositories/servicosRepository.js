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

async function sincronizarPublicacaoAutomatica(
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
      WITH elegibilidade AS (
        SELECT
          n.id,
          (
            (
              COALESCE(cardinality(n.areas), 0) > 0
              OR NULLIF(BTRIM(COALESCE(n.setor, '')), '') IS NOT NULL
            )
            AND NULLIF(BTRIM(COALESCE(n.whatsapp, '')), '') IS NOT NULL
            AND NULLIF(BTRIM(COALESCE(n.cidade, '')), '') IS NOT NULL
            AND UPPER(BTRIM(COALESCE(n.estado, ''))) IN (
              'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
              'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
              'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
            )
            AND EXISTS (
              SELECT 1
              FROM servicos_negocio s
              WHERE s.negocio_id = n.id
                AND s.ativo = TRUE
            )
          ) AS pode_publicar
        FROM negocios n
        WHERE n.id = $1
      )
      UPDATE negocios n
      SET
        publicado = e.pode_publicar,
        updated_at = CASE
          WHEN n.publicado IS DISTINCT FROM e.pode_publicar THEN NOW()
          ELSE n.updated_at
        END
      FROM elegibilidade e
      WHERE n.id = e.id
      RETURNING n.id, n.publicado
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function adicionarEspecialidadeNegocio(
  negocioId,
  especialidade,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE negocios
      SET
        areas = CASE
          WHEN $2 = ANY(COALESCE(areas, ARRAY[]::TEXT[]))
            THEN COALESCE(areas, ARRAY[]::TEXT[])
          ELSE array_append(
            COALESCE(areas, ARRAY[]::TEXT[]),
            $2
          )
        END,
        setor = COALESCE(
          NULLIF(BTRIM(setor), ''),
          $2
        ),
        updated_at = NOW()
      WHERE id = $1
      RETURNING setor, areas
    `,
    [negocioId, especialidade]
  );

  return result.rows[0] || null;
}

async function atualizarFotoServico({ id, negocioId, fotoUrl, fotoPublicId }, executor = db) {
  const result = await executor.query(
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

async function listarFotosServico(servicoId, executor = db) {
  const result = await executor.query(
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

async function buscarFotoGaleriaDoNegocio({ fotoId, negocioId }, executor = db) {
  const result = await executor.query(
    `
    SELECT fs.id, fs.servico_id, fs.foto_url, fs.foto_public_id, fs.created_at
    FROM fotos_servico fs
    INNER JOIN servicos_negocio s
      ON s.id = fs.servico_id
    WHERE fs.id = $1
      AND s.negocio_id = $2
    LIMIT 1
    `,
    [fotoId, negocioId]
  );

  return result.rows[0] || null;
}

async function fotoGaleriaUsaPublicId({ servicoId, fotoPublicId }, executor = db) {
  if (!fotoPublicId) return false;

  const result = await executor.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM fotos_servico
      WHERE servico_id = $1
        AND foto_public_id = $2
    ) AS existe
    `,
    [servicoId, fotoPublicId]
  );

  return result.rows[0]?.existe === true;
}

async function adicionarFotoGaleriaServico({ servicoId, fotoUrl, fotoPublicId }, executor = db) {
  const result = await executor.query(
    `
    INSERT INTO fotos_servico (servico_id, foto_url, foto_public_id)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [servicoId, fotoUrl, fotoPublicId]
  );

  return result.rows[0];
}

async function limparFotoServicoSeUsarPublicId(
  { id, negocioId, fotoPublicId },
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE servicos_negocio
    SET foto_url = NULL,
        foto_public_id = NULL
    WHERE id = $1
      AND negocio_id = $2
      AND foto_public_id = $3
    RETURNING *
    `,
    [id, negocioId, fotoPublicId]
  );

  return result.rows[0] || null;
}

async function removerFotoGaleriaServico({ fotoId, negocioId }, executor = db) {
  const result = await executor.query(
    `
    DELETE FROM fotos_servico fs
    USING servicos_negocio s
    WHERE fs.id = $1
      AND s.id = fs.servico_id
      AND s.negocio_id = $2
    RETURNING
      fs.id,
      fs.servico_id,
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
  sincronizarPublicacaoAutomatica,
  adicionarEspecialidadeNegocio,
  atualizarFotoServico,
  listarFotosServico,
  buscarFotoGaleriaDoNegocio,
  fotoGaleriaUsaPublicId,
  adicionarFotoGaleriaServico,
  limparFotoServicoSeUsarPublicId,
  removerFotoGaleriaServico,
};
