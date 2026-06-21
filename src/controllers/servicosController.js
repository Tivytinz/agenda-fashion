const db = require("../db");
const uploadToCloudinary = require("../utils/uploadCloudinary");

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

async function listarServicos(req, res) {
  try {
    const usuarioId = req.user.id;

    const negocio = await db.query(
      `
      SELECT negocio_id
      FROM usuarios_negocios
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (!negocio.rows.length) {
      return res.json([]);
    }

    const servicos = await db.query(
      `
      SELECT *
      FROM servicos_negocio
      WHERE negocio_id = $1
      ORDER BY nome
      `,
      [negocio.rows[0].negocio_id]
    );

    return res.json(servicos.rows);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      erro: "Erro ao listar serviços."
    });
  }
}

async function criarServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { nome, valor, duracao_minutos } = req.body;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({ erro: "Apenas o dono pode criar serviços." });
    }

    if (!nome || nome.trim().length < 2) {
      return res.status(400).json({ erro: "Nome do serviço inválido." });
    }

    const result = await db.query(
      `
      INSERT INTO servicos_negocio (
        negocio_id,
        nome,
        valor,
        duracao_minutos,
        ativo,
        created_at
      )
      VALUES ($1, $2, $3, $4, true, NOW())
      RETURNING *
      `,
      [
        vinculo.negocio_id,
        nome.trim(),
        Number(valor || 0),
        Number(duracao_minutos || 0)
      ]
    );

    return res.status(201).json({
      mensagem: "Serviço criado com sucesso.",
      servico: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao criar serviço:", err);
    return res.status(500).json({ erro: "Erro ao criar serviço." });
  }
}

async function editarServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;
    const { nome, valor, duracao_minutos } = req.body;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({ erro: "Apenas o dono pode editar serviços." });
    }

    const result = await db.query(
      `
      UPDATE servicos_negocio
      SET
        nome = $1,
        valor = $2,
        duracao_minutos = $3
      WHERE id = $4
        AND negocio_id = $5
      RETURNING *
      `,
      [
        nome?.trim(),
        Number(valor || 0),
        Number(duracao_minutos || 0),
        id,
        vinculo.negocio_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }

    return res.json({
      mensagem: "Serviço atualizado com sucesso.",
      servico: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao editar serviço:", err);
    return res.status(500).json({ erro: "Erro ao editar serviço." });
  }
}

async function removerServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({ erro: "Apenas o dono pode remover serviços." });
    }

    const result = await db.query(
      `
      DELETE FROM servicos_negocio
      WHERE id = $1
        AND negocio_id = $2
      RETURNING id
      `,
      [id, vinculo.negocio_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }

    return res.json({
      mensagem: "Serviço removido com sucesso."
    });

  } catch (err) {
    console.error("Erro ao remover serviço:", err);
    return res.status(500).json({ erro: "Erro ao remover serviço." });
  }
}

async function enviarFotoServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({ erro: "Apenas o dono pode alterar foto do serviço." });
    }

    if (!req.file) {
      return res.status(400).json({ erro: "Nenhuma imagem enviada." });
    }

    const resultado = await uploadToCloudinary(
      req.file.buffer,
      "saas-agendamento/servicos"
    );

    const update = await db.query(
      `
      UPDATE servicos_negocio
      SET
        foto_url = $1,
        foto_public_id = $2
      WHERE id = $3
        AND negocio_id = $4
      RETURNING *
      `,
      [
        resultado.secure_url,
        resultado.public_id,
        id,
        vinculo.negocio_id
      ]
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado." });
    }

    return res.json({
      mensagem: "Foto do serviço atualizada.",
      servico: update.rows[0]
    });

  } catch (err) {
    console.error("Erro ao enviar foto do serviço:", err);
    return res.status(500).json({ erro: "Erro ao enviar foto do serviço." });
  }
}
async function listarFotosServico(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT id, servico_id, foto_url, foto_public_id, created_at
      FROM fotos_servico
      WHERE servico_id = $1
      ORDER BY id DESC
      `,
      [id]
    );

    return res.json({
      fotos: result.rows
    });

  } catch (err) {
    console.error("Erro ao listar fotos do serviço:", err);
    return res.status(500).json({
      erro: "Erro ao listar fotos do serviço."
    });
  }
}

async function adicionarFotoGaleriaServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({
        erro: "Apenas o dono pode adicionar fotos ao serviço."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhuma imagem enviada."
      });
    }

    const servicoResult = await db.query(
      `
      SELECT id
      FROM servicos_negocio
      WHERE id = $1
        AND negocio_id = $2
      LIMIT 1
      `,
      [id, vinculo.negocio_id]
    );

    if (servicoResult.rows.length === 0) {
      return res.status(404).json({
        erro: "Serviço não encontrado."
      });
    }

    const resultado = await uploadToCloudinary(
      req.file.buffer,
      "saas-agendamento/servicos/galeria"
    );

    const foto = await db.query(
      `
      INSERT INTO fotos_servico (
        servico_id,
        foto_url,
        foto_public_id
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [
        id,
        resultado.secure_url,
        resultado.public_id
      ]
    );

    return res.status(201).json({
      mensagem: "Foto adicionada à galeria.",
      foto: foto.rows[0]
    });

  } catch (err) {
    console.error("Erro ao adicionar foto na galeria:", err);
    return res.status(500).json({
      erro: "Erro ao adicionar foto na galeria."
    });
  }
}

async function removerFotoGaleriaServico(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { fotoId } = req.params;

    const vinculo = await buscarNegocioDono(usuarioId);

    if (!vinculo) {
      return res.status(403).json({
        erro: "Apenas o dono pode remover fotos do serviço."
      });
    }

    const result = await db.query(
      `
      DELETE FROM fotos_servico fs
      USING servicos_negocio s
      WHERE fs.id = $1
        AND s.id = fs.servico_id
        AND s.negocio_id = $2
      RETURNING fs.id
      `,
      [fotoId, vinculo.negocio_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Foto não encontrada."
      });
    }

    return res.json({
      mensagem: "Foto removida da galeria."
    });

  } catch (err) {
    console.error("Erro ao remover foto da galeria:", err);
    return res.status(500).json({
      erro: "Erro ao remover foto da galeria."
    });
  }
}

module.exports = {
  listarServicos,
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  removerFotoGaleriaServico
};