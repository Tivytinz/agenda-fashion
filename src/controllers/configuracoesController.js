const db = require("../db");

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT
      un.negocio_id,
      un.papel
    FROM usuarios_negocios un
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

function normalizarAreas(areas) {
  if (!areas) return [];

  if (Array.isArray(areas)) {
    return areas;
  }

  if (typeof areas === "string") {
    try {
      const parsed = JSON.parse(areas);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return areas
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

// =============================
// 🔍 BUSCAR CONFIGURAÇÕES
// =============================
async function buscarConfiguracoes(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const negocioUsuario = await buscarNegocioDoUsuario(usuarioId);

    if (!negocioUsuario) {
      return res.status(404).json({
        erro: "Usuário não está vinculado a nenhum negócio."
      });
    }

    const result = await db.query(
      `
      SELECT
        n.id,
        n.id AS negocio_id,
        n.nome,
        n.nome AS nome_negocio,
        n.slug,
        n.foto_url,
        n.foto_public_id,
        n.descricao,
        n.setor,
        n.cidade,
        n.bairro,
        n.localizacao_url,
        n.whatsapp_negocio,
        n.areas
      FROM negocios n
      WHERE n.id = $1
      LIMIT 1
      `,
      [negocioUsuario.negocio_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const negocio = result.rows[0];

    return res.json({
      negocio: {
        ...negocio,
        areas: normalizarAreas(negocio.areas)
      },
      configuracoes: {
        ...negocio,
        areas: normalizarAreas(negocio.areas)
      }
    });

  } catch (err) {
    console.error("Erro ao buscar configurações:", err);

    return res.status(500).json({
      erro: "Erro ao buscar configurações."
    });
  }
}

// =============================
// 💾 SALVAR CONFIGURAÇÕES
// =============================
async function salvarConfiguracoes(req, res) {
  try {
    const usuarioId = req.user?.id;

    const {
      nome,
      foto_url,
      descricao,
      setor,
      cidade,
      bairro,
      localizacao_url,
      whatsapp_negocio,
      areas
    } = req.body;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const negocioUsuario = await buscarNegocioDoUsuario(usuarioId);

    if (!negocioUsuario) {
      return res.status(404).json({
        erro: "Usuário não está vinculado a nenhum negócio."
      });
    }

    if (negocioUsuario.papel !== "dono") {
      return res.status(403).json({
        erro: "Apenas o dono pode editar o negócio."
      });
    }

    const negocioAtualResult = await db.query(
      `
      SELECT *
      FROM negocios
      WHERE id = $1
      LIMIT 1
      `,
      [negocioUsuario.negocio_id]
    );

    if (negocioAtualResult.rows.length === 0) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const negocioAtual = negocioAtualResult.rows[0];

    const areasFinal = normalizarAreas(
      areas !== undefined ? areas : negocioAtual.areas
    );

    const result = await db.query(
      `
      UPDATE negocios
      SET
        nome = $1,
        foto_url = $2,
        descricao = $3,
        setor = $4,
        cidade = $5,
        bairro = $6,
        localizacao_url = $7,
        whatsapp_negocio = $8,
        areas = $9
      WHERE id = $10
      RETURNING
        id,
        nome,
        slug,
        foto_url,
        foto_public_id,
        descricao,
        setor,
        cidade,
        bairro,
        localizacao_url,
        whatsapp_negocio,
        areas
      `,
      [
        nome !== undefined ? nome : negocioAtual.nome,
        foto_url !== undefined ? foto_url : negocioAtual.foto_url,
        descricao !== undefined ? descricao : negocioAtual.descricao,
        setor !== undefined ? setor : negocioAtual.setor,
        cidade !== undefined ? cidade : negocioAtual.cidade,
        bairro !== undefined ? bairro : negocioAtual.bairro,
        localizacao_url !== undefined ? localizacao_url : negocioAtual.localizacao_url,
        whatsapp_negocio !== undefined ? whatsapp_negocio : negocioAtual.whatsapp_negocio,
        areasFinal,
        negocioUsuario.negocio_id
      ]
    );

    const negocio = result.rows[0];

    return res.json({
      mensagem: "Configurações salvas com sucesso.",
      negocio: {
        ...negocio,
        areas: normalizarAreas(negocio.areas),
        papel: negocioUsuario.papel
      },
      configuracoes: {
        ...negocio,
        areas: normalizarAreas(negocio.areas)
      }
    });

  } catch (err) {
    console.error("Erro ao salvar configurações:", err);

    return res.status(500).json({
      erro: "Erro ao salvar configurações."
    });
  }
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes
};