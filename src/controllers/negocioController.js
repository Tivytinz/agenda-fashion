const db = require("../db");

// =============================
// 🔤 GERAR SLUG
// =============================
function gerarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// =============================
// 🔁 SLUG ÚNICO
// =============================
async function gerarSlugUnico(baseSlug) {
  let slug = baseSlug;
  let contador = 2;

  while (true) {
    const existe = await db.query(
      "SELECT id FROM negocios WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (existe.rows.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${contador}`;
    contador++;
  }
}

// =============================
// ➕ CRIAR NEGÓCIO
// =============================
async function criarNegocio(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { nome } = req.body;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({
        erro: "Nome do negócio inválido."
      });
    }

    const existe = await db.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({
        erro: "Você já possui um negócio."
      });
    }

    const baseSlug = gerarSlug(nome);

    if (!baseSlug) {
      return res.status(400).json({
        erro: "Erro ao gerar link do negócio."
      });
    }

    const slug = await gerarSlugUnico(baseSlug);

    const novoNegocio = await db.query(
  `
  INSERT INTO negocios (
    nome,
    slug,
    dono_usuario_id,
    created_at
  )
  VALUES (
    $1,
    $2,
    $3,
    NOW()
  )
  RETURNING
    id,
    nome,
    slug
  `,
  [
    nome.trim(),
    slug,
    usuarioId
  ]
);

    const negocio = novoNegocio.rows[0];

    await db.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel
      )
      VALUES (
        $1,
        $2,
        'dono'
      )
      `,
      [usuarioId, negocio.id]
    );

    return res.status(201).json({
      mensagem: "Negócio criado com sucesso.",
      negocio: {
        ...negocio,
        papel: "dono"
      }
    });

  } catch (err) {
    console.error("Erro ao criar negócio:", err);

    return res.status(500).json({
      erro: "Erro ao criar negócio."
    });
  }
}

// =============================
// 🔍 BUSCAR MEU NEGÓCIO
// =============================
async function buscarMeuNegocio(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const result = await db.query(
      `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.foto_url,
        n.foto_public_id,
        n.descricao,
        n.cidade,
        n.setor,
        n.whatsapp_negocio,
        n.localizacao_url,
        n.areas,
        un.papel,
        u.nome AS profissional
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
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
    console.error("Erro ao buscar negócio:", err);

    return res.status(500).json({
      erro: "Erro ao buscar negócio."
    });
  }
}

module.exports = {
  criarNegocio,
  buscarMeuNegocio
};