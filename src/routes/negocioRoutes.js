const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload");
const uploadToCloudinary = require("../utils/uploadCloudinary");
const db = require("../db/db");
const auth = require("../middlewares/auth");
const negocioController = require("../controllers/negocioController");

// =============================
// 🏢 NEGÓCIOS
// =============================

router.post(
  "/criar-negocio",
  auth,
  negocioController.criarNegocio
);

router.get(
  "/meu-negocio",
  auth,
  negocioController.buscarMeuNegocio
);

router.get(
  "/negocios/buscar",
  negocioController.buscarNegocios
);

router.post("/foto", auth, upload.single("foto"), async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhuma imagem enviada"
      });
    }

    const negocioResult = await db.query(
      `
      SELECT n.id
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
      LIMIT 1
      `,
      [usuarioId]
    );

    if (negocioResult.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não é dono de nenhum negócio"
      });
    }

    const negocioId = negocioResult.rows[0].id;

    const resultado = await uploadToCloudinary(
      req.file.buffer,
      "saas-agendamento/negocios"
    );

    const fotoUrl = resultado.secure_url;
    const publicId = resultado.public_id;

    const update = await db.query(
      `
      UPDATE negocios
      SET foto_url = $1,
          foto_public_id = $2
      WHERE id = $3
      RETURNING id, nome, slug, foto_url, foto_public_id
      `,
      [fotoUrl, publicId, negocioId]
    );

    res.json({
      sucesso: true,
      mensagem: "Foto do negócio salva com sucesso",
      negocio: update.rows[0],
      foto: fotoUrl,
      publicId
    });

  } catch (error) {
    console.error("Erro no upload:", error);

    res.status(500).json({
      erro: "Erro ao enviar imagem"
    });
  }
});

module.exports = router;