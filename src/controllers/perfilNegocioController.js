const db = require("../db");

// =============================
// 🔧 NORMALIZAR ÁREAS
// =============================
function normalizarAreas(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) return valor;

  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return valor
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

// =============================
// 🌍 LISTAR NEGÓCIOS PÚBLICOS
// =============================
async function listarNegociosPublicos(req, res) {
  try {
    const result = await db.query(
      `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.foto_url,
        n.descricao,
        n.setor,
        n.cidade,
        n.bairro,
        n.whatsapp_negocio,
        n.localizacao_url,
        n.areas,
        n.latitude,
        n.longitude
      FROM negocios n
      ORDER BY n.nome ASC
      `
    );

    const negocios = result.rows.map((item) => ({
      ...item,
      areas: normalizarAreas(item.areas)
    }));

    return res.json({ negocios });

  } catch (err) {
    console.error("Erro ao listar negócios públicos:", err);

    return res.status(500).json({
      erro: "Erro ao carregar negócios."
    });
  }
}

// =============================
// 🔍 BUSCAR PERFIL DO NEGÓCIO
// =============================
async function buscarPerfilPublico(req, res) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        erro: "Slug do negócio não informado."
      });
    }

    const negocioResult = await db.query(
      `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.foto_url,
        n.foto_public_id,
        n.descricao,
        n.setor,
        n.cidade,
        n.bairro,
        n.localizacao_url,
        n.whatsapp_negocio,
        n.areas,
        n.latitude,
        n.longitude
      FROM negocios n
      WHERE n.slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (negocioResult.rows.length === 0) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const negocio = negocioResult.rows[0];

    const servicosResult = await db.query(
      `
      SELECT
        id,
        nome,
        valor,
        duracao_minutos,
        foto_url
      FROM servicos_negocio
      WHERE negocio_id = $1
      ORDER BY nome ASC
      `,
      [negocio.id]
    );

    const profissionaisResult = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.whatsapp
      FROM usuarios u
      INNER JOIN usuarios_negocios un
        ON un.usuario_id = u.id
      WHERE un.negocio_id = $1
      ORDER BY u.nome ASC
      `,
      [negocio.id]
    );

    return res.json({
      negocio: {
        ...negocio,
        areas: normalizarAreas(negocio.areas)
      },
      servicos: servicosResult.rows,
      profissionais: profissionaisResult.rows
    });

  } catch (err) {
    console.error("Erro ao buscar perfil público:", err);

    return res.status(500).json({
      erro: "Erro ao carregar perfil do negócio."
    });
  }
}

module.exports = {
  listarNegociosPublicos,
  buscarPerfilPublico
};