const express = require("express");
const router = express.Router();

const perfilNegocioController = require("../controllers/perfilNegocioController");

/**
 * @swagger
 * tags:
 *   name: Perfil do Negócio
 *   description: Consulta pública dos negócios cadastrados
 */

/**
 * @swagger
 * /negocios-publicos:
 *   get:
 *     summary: Lista os negócios públicos disponíveis
 *     tags: [Perfil do Negócio]
 *     parameters:
 *       - in: query
 *         name: busca
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 24
 *     responses:
 *       200:
 *         description: Lista de negócios retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 negocios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nome:
 *                         type: string
 *                         example: Studio Beauty
 *                       slug:
 *                         type: string
 *                         example: studio-beauty
 *                       foto_url:
 *                         type: string
 *                         nullable: true
 *                       cidade:
 *                         type: string
 *                         example: Goiânia
 *                       bairro:
 *                         type: string
 *                         example: Centro
 */ 
router.get(
  "/negocios-publicos",
  perfilNegocioController.listarNegociosPublicos
);

/**
 * @swagger
 * /perfil-negocio/{slug}:
 *   get:
 *     summary: Busca o perfil público de um negócio
 *     tags: [Perfil do Negócio]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug do negócio
 *         example: studio-beauty
 *     responses:
 *       200:
 *         description: Perfil do negócio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 negocio:
 *                   type: object
 *                 servicos:
 *                   type: array
 *                   items:
 *                     type: object
 *                 profissionais:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Negócio não encontrado
 */

router.get(
  "/perfil-negocio/:slug",
  perfilNegocioController.buscarPerfilPublico
);

module.exports = router;
