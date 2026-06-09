const db = require("../db");

function garantirCliente(req, res) {
  if (!req.user?.id) {
    res.status(401).json({ erro: "Usuário não autenticado." });
    return false;
  }

  if (req.user.tipo !== "cliente") {
    res.status(403).json({ erro: "Apenas clientes podem favoritar." });
    return false;
  }

  return true;
}

async function listarFavoritos(req, res) {
  try {
    if (!garantirCliente(req, res)) return;

    const clienteId = req.user.id;

    const result = await db.query(
  `
  SELECT
    n.id,
    n.nome,
    n.slug,
    n.foto_url,
    n.cidade,
    n.setor,
    n.descricao
  FROM favoritos f
  INNER JOIN negocios n ON n.id = f.negocio_id
  WHERE f.cliente_id = $1
  ORDER BY f.created_at DESC
  `,
  [clienteId]
);

    return res.json({ favoritos: result.rows });
  } catch (err) {
    console.error("Erro ao listar favoritos:", err);
    return res.status(500).json({ erro: "Erro ao listar favoritos." });
  }
}

async function adicionarFavorito(req, res) {
  try {
    if (!garantirCliente(req, res)) return;

    const clienteId = req.user.id;
    const { negocioId } = req.params;

    const negocio = await db.query(
      `SELECT id FROM negocios WHERE id = $1 LIMIT 1`,
      [negocioId]
    );

    if (!negocio.rows.length) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    await db.query(
      `
      INSERT INTO favoritos (cliente_id, negocio_id)
      VALUES ($1, $2)
      ON CONFLICT (cliente_id, negocio_id) DO NOTHING
      `,
      [clienteId, negocioId]
    );

    return res.json({ mensagem: "Adicionado aos favoritos." });
  } catch (err) {
    console.error("Erro ao adicionar favorito:", err);
    return res.status(500).json({ erro: "Erro ao adicionar favorito." });
  }
}

async function removerFavorito(req, res) {
  try {
    if (!garantirCliente(req, res)) return;

    const clienteId = req.user.id;
    const { negocioId } = req.params;

    await db.query(
      `
      DELETE FROM favoritos
      WHERE cliente_id = $1
        AND negocio_id = $2
      `,
      [clienteId, negocioId]
    );

    return res.json({ mensagem: "Removido dos favoritos." });
  } catch (err) {
    console.error("Erro ao remover favorito:", err);
    return res.status(500).json({ erro: "Erro ao remover favorito." });
  }
}

async function verificarFavorito(req, res) {
  try {
    if (!garantirCliente(req, res)) return;

    const clienteId = req.user.id;
    const { negocioId } = req.params;

    const result = await db.query(
      `
      SELECT id
      FROM favoritos
      WHERE cliente_id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [clienteId, negocioId]
    );

    return res.json({ favoritado: result.rows.length > 0 });
  } catch (err) {
    console.error("Erro ao verificar favorito:", err);
    return res.status(500).json({ erro: "Erro ao verificar favorito." });
  }
}

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito
};