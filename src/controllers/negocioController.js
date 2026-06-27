const db = require("../db");
const { criarClienteAsaas } = require("../services/asaasService");

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
async function gerarSlugUnico(baseSlug, client = db) {
  let slug = baseSlug;
  let contador = 2;

  while (true) {
    const existe = await client.query(
      "SELECT id FROM negocios WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (existe.rows.length === 0) return slug;

    slug = `${baseSlug}-${contador}`;
    contador++;
  }
}

// =============================
// ➕ CRIAR NEGÓCIO
// =============================
async function criarNegocio(req, res) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const usuarioId = req.user?.id;
    const { nome } = req.body;

    if (!usuarioId) {
      await client.query("ROLLBACK");
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!nome || nome.trim().length < 3) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro: "Nome do negócio inválido." });
    }

    const usuarioResult = await client.query(
      `
      SELECT id, nome, email, whatsapp
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (usuarioResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const usuario = usuarioResult.rows[0];

    const existe = await client.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (existe.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro: "Você já possui um negócio." });
    }

    const planoGratis = await client.query(
      `
      SELECT id
      FROM planos
      WHERE slug = 'gratis'
        AND ativo = true
      LIMIT 1
      `
    );

    if (planoGratis.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({ erro: "Plano gratuito não encontrado." });
    }

    const baseSlug = gerarSlug(nome);

    if (!baseSlug) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro: "Erro ao gerar link do negócio." });
    }

    const slug = await gerarSlugUnico(baseSlug, client);
    const planoId = planoGratis.rows[0].id;

    const novoNegocio = await client.query(
      `
      INSERT INTO negocios (
        nome,
        slug,
        dono_usuario_id,
        plano_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
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
        planoId
      ]
    );

    const negocio = novoNegocio.rows[0];

    const clienteAsaas = await criarClienteAsaas({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.whatsapp || ""
    });

    await client.query(
      `
      UPDATE negocios
      SET asaas_customer_id = $1
      WHERE id = $2
      `,
      [
        clienteAsaas.id,
        negocio.id
      ]
    );

    await client.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel
      )
      VALUES ($1, $2, 'dono')
      `,
      [
        usuarioId,
        negocio.id
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      mensagem: "Negócio criado com sucesso.",
      negocio: {
        ...negocio,
        asaas_customer_id: clienteAsaas.id,
        papel: "dono",
        plano: {
          id: planoId,
          slug: "gratis"
        }
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Erro ao criar negócio:", err);

    return res.status(500).json({
      erro: "Erro ao criar negócio."
    });

  } finally {
    client.release();
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
        n.asaas_customer_id,

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