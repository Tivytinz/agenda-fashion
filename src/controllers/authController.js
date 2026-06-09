const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

// =========================
// CADASTRO
// =========================
async function cadastro(req, res) {
  const { nome, email, senha, whatsapp, tipo } = req.body;

  try {
    if (!nome || !email || !senha || !whatsapp) {
      return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
    }

    if (senha.trim().length < 6) {
      return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
    }

    const emailLimpo = email.trim().toLowerCase();
    const tipoUsuario = tipo || "cliente";

    const usuarioExistente = await db.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [emailLimpo]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ erro: "Email já cadastrado." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const novoUsuario = await db.query(
      `INSERT INTO usuarios
        (nome, email, senha, whatsapp, tipo)
       VALUES
        ($1, $2, $3, $4, $5)
       RETURNING id, nome, email, whatsapp, tipo`,
      [
        nome.trim(),
        emailLimpo,
        senhaHash,
        whatsapp.trim(),
        tipoUsuario
      ]
    );

    return res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",
      usuario: novoUsuario.rows[0]
    });

  } catch (err) {
    console.error("Erro no cadastro:", err);
    return res.status(500).json({ erro: "Erro no cadastro." });
  }
}

// =========================
// LOGIN
// =========================
async function login(req, res) {
  const { email, senha } = req.body;

  try {
    if (!email || !senha) {
      return res.status(400).json({ erro: "Email e senha são obrigatórios." });
    }

    const usuario = await db.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (usuario.rows.length === 0) {
      return res.status(400).json({ erro: "Usuário não encontrado." });
    }

    const usuarioData = usuario.rows[0];

    const senhaValida = await bcrypt.compare(senha, usuarioData.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha inválida." });
    }

    const token = jwt.sign(
      {
        id: usuarioData.id,
        tipo: usuarioData.tipo
      },
      "segredo",
      { expiresIn: "1d" }
    );

    return res.json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: {
        id: usuarioData.id,
        nome: usuarioData.nome,
        email: usuarioData.email,
        whatsapp: usuarioData.whatsapp,
        tipo: usuarioData.tipo
      }
    });

  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ erro: "Erro no login." });
  }
}

// =========================
// MEU NEGÓCIO
// =========================
async function meuNegocio(req, res) {
  try {
    const usuarioId = req.user.id;

    const result = await db.query(
      `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.dono_usuario_id,
        un.papel,
        un.negocio_id
      FROM usuarios_negocios un
      INNER JOIN negocios n ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.json({
        temNegocio: false
      });
    }

    return res.json({
      temNegocio: true,
      negocio: result.rows[0]
    });

  } catch (err) {
    console.error("Erro ao buscar meu negócio:", err);
    return res.status(500).json({ erro: "Erro ao buscar negócio." });
  }
}

module.exports = {
  cadastro,
  login,
  meuNegocio
};