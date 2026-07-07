const db = require("../db/db");

async function buscarNegocioPorSlug(slug) {
  const result = await db.query(
    `
    SELECT id, nome, slug
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(servicoId, negocioId) {
  const result = await db.query(
    `
    SELECT id, nome, valor, duracao_minutos
    FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [servicoId, negocioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalDoNegocio(profissionalId, negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
    LIMIT 1
    `,
    [profissionalId, negocioId]
  );

  return result.rows[0] || null;
}

async function listarAgendamentosOcupados(profissionalId, dataInicio, dataFim) {
  const result = await db.query(
    `
    SELECT
      TO_CHAR(data, 'YYYY-MM-DD') AS data,
      TO_CHAR(horario::time, 'HH24:MI') AS horario
    FROM agendamentos
    WHERE profissional_id = $1
      AND data BETWEEN $2 AND $3
      AND status IN ('agendado', 'confirmado')
    `,
    [profissionalId, dataInicio, dataFim]
  );

  return result.rows;
}

async function listarBloqueios(profissionalId, dataInicio, dataFim) {
  const result = await db.query(
    `
    SELECT
      TO_CHAR(data_bloqueio, 'YYYY-MM-DD') AS data,
      TO_CHAR(hora_bloqueio, 'HH24:MI') AS horario
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio BETWEEN $2 AND $3
    `,
    [profissionalId, dataInicio, dataFim]
  );

  return result.rows;
}

async function buscarClientePorWhatsapp(whatsapp) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios
    WHERE tipo = 'cliente'
      AND whatsapp = $1
    LIMIT 1
    `,
    [whatsapp]
  );

  return result.rows[0] || null;
}

async function criarCliente(nome, whatsapp) {
  const result = await db.query(
    `
    INSERT INTO usuarios (
      nome,
      email,
      whatsapp,
      senha,
      tipo
    )
    VALUES ($1, $2, $3, $4, 'cliente')
    RETURNING id
    `,
    [
      nome.trim(),
      `cliente_${Date.now()}@agenda.local`,
      whatsapp.trim(),
      ""
    ]
  );

  return result.rows[0];
}

module.exports = {
  buscarNegocioPorSlug,
  buscarServicoDoNegocio,
  buscarProfissionalDoNegocio,
  listarAgendamentosOcupados,
  listarBloqueios,
  buscarClientePorWhatsapp,
  criarCliente,
};