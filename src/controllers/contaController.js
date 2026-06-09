const bcrypt = require("bcrypt");
const db = require("../db");
const uploadToCloudinary = require("../utils/uploadCloudinary");

// =============================
// BUSCAR MINHA CONTA
// =============================
async function buscarMinhaConta(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const result = await db.query(
      `
      SELECT
        id,
        nome,
        email,
        whatsapp,
        tipo,
        foto_url
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    return res.json({
      usuario: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao buscar conta:", err);
    return res.status(500).json({ erro: "Erro ao buscar conta." });
  }
}

// =============================
// ATUALIZAR MINHA CONTA
// =============================
async function atualizarMinhaConta(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { nome, whatsapp } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({ erro: "Nome inválido." });
    }

    if (!whatsapp || whatsapp.trim().length < 8) {
      return res.status(400).json({ erro: "WhatsApp inválido." });
    }

    const result = await db.query(
      `
      UPDATE usuarios
      SET
        nome = $1,
        whatsapp = $2
      WHERE id = $3
      RETURNING id, nome, email, whatsapp, tipo
      `,
      [
        nome.trim(),
        whatsapp.trim(),
        usuarioId
      ]
    );

    return res.json({
      mensagem: "Conta atualizada com sucesso.",
      usuario: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao atualizar conta:", err);
    return res.status(500).json({ erro: "Erro ao atualizar conta." });
  }
}

// =============================
// ALTERAR SENHA
// =============================
async function alterarSenha(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { senhaAtual, novaSenha } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: "Informe a senha atual e a nova senha." });
    }

    if (novaSenha.trim().length < 6) {
      return res.status(400).json({ erro: "A nova senha deve ter pelo menos 6 caracteres." });
    }

    const usuario = await db.query(
      `
      SELECT id, senha
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.rows[0].senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha atual incorreta." });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await db.query(
      `
      UPDATE usuarios
      SET senha = $1
      WHERE id = $2
      `,
      [senhaHash, usuarioId]
    );

    return res.json({
      mensagem: "Senha alterada com sucesso."
    });

  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    return res.status(500).json({ erro: "Erro ao alterar senha." });
  }
}
async function enviarFotoUsuario(req, res) {
  try {

    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhuma imagem enviada."
      });
    }

    const resultado = await uploadToCloudinary(
      req.file.buffer,
      "saas-agendamento/usuarios"
    );

    await db.query(
      `
      UPDATE usuarios
      SET
        foto_url = $1,
        foto_public_id = $2
      WHERE id = $3
      `,
      [
        resultado.secure_url,
        resultado.public_id,
        usuarioId
      ]
    );

    return res.json({
      mensagem: "Foto atualizada.",
      foto: resultado.secure_url
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      erro: "Erro ao enviar foto."
    });
  }
}

module.exports = {
  buscarMinhaConta,
  atualizarMinhaConta,
  alterarSenha,
  enviarFotoUsuario
};