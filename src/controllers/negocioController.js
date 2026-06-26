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

    if (existe.rows.length === 0) return slug;

    slug = `${baseSlug}-${contador}`;
    contador++;
  }
}

// =============================
// 💎 BUSCAR PLANO GRÁTIS
// =============================
async function buscarPlanoGratis() {
  const result = await db.query(
    `
    SELECT id
    FROM planos
    WHERE slug = 'gratis'
      AND ativo = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
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

    const planoGratis = await buscarPlanoGratis();

    if (!planoGratis) {
      return res.status(500).json({
        erro: "Plano gratuito não encontrado."
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
        plano_id,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW()
      )
      RETURNING
        id,
        nome,
        slug,
        dono_usuario_id,
        plano_id,
        created_at
      `,
      [
        nome.trim(),
        slug,
        usuarioId,
        planoGratis.id
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
        papel: "dono",
        plano: {
          id: planoGratis.id,
          slug: "gratis"
        }
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
        n.bairro,
        n.setor,
        n.whatsapp_negocio,
        n.localizacao_url,
        n.areas,
        n.visitas,
        n.cliques_whatsapp,
        n.cliques_maps,
        n.plano_id,

        p.nome AS plano_nome,
        p.slug AS plano_slug,
        p.valor AS plano_valor,
        p.capacidade_agendamentos,

        un.papel,
        u.nome AS profissional
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      LEFT JOIN planos p
        ON p.id = n.plano_id
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

    const negocio = result.rows[0];

    const profissionaisResult = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.whatsapp,
        u.tipo,
        u.foto_url,
        un.papel
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      WHERE un.negocio_id = $1
      ORDER BY
        CASE
          WHEN un.papel = 'dono' THEN 1
          ELSE 2
        END,
        u.nome ASC
      `,
      [negocio.id]
    );

    return res.json({
      temNegocio: true,
      negocio: {
        ...negocio,
        plano: {
          id: negocio.plano_id,
          nome: negocio.plano_nome,
          slug: negocio.plano_slug,
          valor: negocio.plano_valor,
          capacidade_agendamentos: negocio.capacidade_agendamentos
        }
      },
      profissionais: profissionaisResult.rows
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