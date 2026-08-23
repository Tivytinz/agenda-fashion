const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const {
  limitarUpload
} = require(
  "../middlewares/rateLimits"
);

const {
  listarServicos,
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  definirFotoCapaServico,
  removerFotoGaleriaServico
} = require("../controllers/servicosController");

/**
 * @swagger
 * tags:
 *   name: Serviços
 *   description: Gerenciamento de serviços do negócio
 */

/**
 * @swagger
 * /servicos:
 *   get:
 *     summary: Lista serviços do negócio do usuário logado
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de serviços
 */

/**
 * @swagger
 * /servicos:
 *   post:
 *     summary: Cria um novo serviço
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Alongamento de unhas
 *               valor:
 *                 type: number
 *                 example: 80
 *               duracao_minutos:
 *                 type: number
 *                 example: 60
 *     responses:
 *       201:
 *         description: Serviço criado com sucesso
 */

/**
 * @swagger
 * /servicos/{id}:
 *   put:
 *     summary: Atualiza um serviço
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do serviço
 *     responses:
 *       200:
 *         description: Serviço atualizado
 */

/**
 * @swagger
 * /servicos/{id}:
 *   delete:
 *     summary: Remove um serviço
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Serviço removido
 */

router.get("/", auth, listarServicos);
router.post("/", auth, criarServico);
router.put("/:id", auth, editarServico);
router.delete("/:id", auth, removerServico);
router.post(
  "/:id/foto",
  limitarUpload,
  auth,
  upload.single("foto"),
  enviarFotoServico
);

router.get("/:id/fotos", auth, listarFotosServico);

router.post(
  "/:id/fotos",
  limitarUpload,
  auth,
  upload.single("foto"),
  adicionarFotoGaleriaServico
);

router.put(
  "/:id/capa",
  auth,
  definirFotoCapaServico
);

router.delete(
  "/fotos/:fotoId",
  auth,
  removerFotoGaleriaServico
);

module.exports = router;
