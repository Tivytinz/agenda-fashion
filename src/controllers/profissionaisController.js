const db = require("../db/db");

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

async function editarProfissional(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;
    const { nome, whatsapp } = req.body;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({
        erro: "Apenas o dono pode editar profissionais."
      });
    }

    if (!nome || nome.trim().length < 2) {
      return res.status(400).json({
        erro: "Nome do profissional inválido."
      });
    }

    const pertence = await db.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [id, vinculo.negocio_id]
    );

    if (pertence.rows.length === 0) {
      return res.status(404).json({
        erro: "Profissional não encontrado neste negócio."
      });
    }

    const result = await db.query(
      `
      UPDATE usuarios
      SET
        nome = $1,
        whatsapp = $2
      WHERE id = $3
      RETURNING id, nome, email, whatsapp, tipo, foto_url
      `,
      [
        nome.trim(),
        whatsapp || "",
        id
      ]
    );

    return res.json({
      mensagem: "Profissional atualizado com sucesso.",
      profissional: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao editar profissional:", err);

    return res.status(500).json({
      erro: "Erro ao editar profissional."
    });
  }
}

async function removerProfissional(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({
        erro: "Apenas o dono pode remover profissionais."
      });
    }

    if (Number(usuarioId) === Number(id)) {
      return res.status(400).json({
        erro: "O dono não pode remover a si mesmo."
      });
    }

    const result = await db.query(
      `
      DELETE FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      RETURNING id
      `,
      [id, vinculo.negocio_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Profissional não encontrado."
      });
    }

    return res.json({
      mensagem: "Profissional removido do negócio."
    });

  } catch (err) {
    console.error("Erro ao remover profissional:", err);

    return res.status(500).json({
      erro: "Erro ao remover profissional."
    });
  }
}

async function vincularProfissional(req, res) {
  try {
    const usuarioDonoId = req.user?.id;
    const { emailOuWhatsapp } = req.body;

    if (!emailOuWhatsapp) {
      return res.status(400).json({
        erro: "Informe o e-mail ou WhatsApp do profissional."
      });
    }

    const dono = await buscarNegocioDono(usuarioDonoId);

    if (!dono) {
      return res.status(403).json({
        erro: "Apenas o dono pode adicionar profissionais."
      });
    }

    const valorLimpo = emailOuWhatsapp.trim().toLowerCase();
    const whatsappLimpo = emailOuWhatsapp.replace(/\D/g, "");

    const profissionalResult = await db.query(
      `
      SELECT
        id,
        nome,
        email,
        whatsapp,
        tipo,
        foto_url
      FROM usuarios
      WHERE tipo = 'profissional'
        AND (
          LOWER(email) = $1
          OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\\D', '', 'g') = $2
        )
      LIMIT 1
      `,
      [valorLimpo, whatsappLimpo]
    );

    if (profissionalResult.rows.length === 0) {
      return res.status(404).json({
        erro: "Profissional não encontrado. Ele precisa criar uma conta profissional primeiro."
      });
    }

    const profissional = profissionalResult.rows[0];

    const jaVinculado = await db.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [profissional.id, dono.negocio_id]
    );

    if (jaVinculado.rows.length > 0) {
      return res.status(400).json({
        erro: "Este profissional já está vinculado ao negócio."
      });
    }

    await db.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel
      )
      VALUES ($1, $2, 'profissional')
      `,
      [profissional.id, dono.negocio_id]
    );

    return res.status(201).json({
      mensagem: "Profissional vinculado com sucesso.",
      profissional
    });

  } catch (err) {
    console.error("Erro ao vincular profissional:", err);

    return res.status(500).json({
      erro: "Erro ao vincular profissional."
    });
  }
}

module.exports = {
  vincularProfissional,
  editarProfissional,
  removerProfissional
};