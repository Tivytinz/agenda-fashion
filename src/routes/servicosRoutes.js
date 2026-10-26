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
  consultarTentativaCriacao,
  consultarTentativaFoto,
  criarServico,
  editarServico,
  alterarAtivoServico,
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
 *               negocio_id:
 *                 type: integer
 *                 description: Alvo explícito, obrigatório quando Idempotency-Key é enviado; a propriedade é validada no backend.
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
 * /servicos/tentativa:
 *   get:
 *     summary: Recupera uma tentativa de criação sem repetir a escrita
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: negocio_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tentativa ausente ou cadastro canônico confirmado; ausência mantém a mesma chave no cliente.
 *       403:
 *         description: Conta, negócio ou vínculo de dona sem autorização ativa.
 *       410:
 *         description: O serviço confirmado por esta tentativa foi removido.
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
router.get("/tentativa", auth, consultarTentativaCriacao);
router.post("/", auth, criarServico);
router.put("/:id", auth, editarServico);
router.patch("/:id/ativo", auth, alterarAtivoServico);
router.delete("/:id", auth, removerServico);
router.post(
  "/:id/foto",
  limitarUpload,
  auth,
  upload.single("foto"),
  enviarFotoServico
);

router.get("/:id/fotos", auth, listarFotosServico);
/**
 * @swagger
 * /servicos/{id}/fotos/tentativa:
 *   get:
 *     summary: Consulta o resultado de um upload sem reenviar o arquivo
 *     tags: [Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Foto confirmada ou tentativa ainda não encontrada; ausência preserva a chave.
 *       410:
 *         description: Foto removida, sem recriação pela tentativa anterior.
 */
router.get("/:id/fotos/tentativa", auth, consultarTentativaFoto);

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
