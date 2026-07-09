const express = require("express");
const router = express.Router();

const optionalAuth = require("../middlewares/optionalAuth");  
const auth = require("../middlewares/auth");
const agendaPublicaController = require("../controllers/agendaPublicaController");

/**
 * @swagger
 * tags:
 *   name: Agenda Pública
 *   description: Agendamento público e gerenciamento dos agendamentos do cliente
 */

/**
 * @swagger
 * /agenda-publica:
 *   get:
 *     summary: Busca horários disponíveis para agendamento
 *     tags: [Agenda Pública]
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         example: studio-beauty
 *       - in: query
 *         name: servicoId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: profissionalId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Agenda retornada com sucesso
 *       404:
 *         description: Negócio não encontrado
 */

router.get(
  "/agenda-publica",
  agendaPublicaController.buscarAgendaPublica
);

/**
 * @swagger
 * /agendamentos:
 *   post:
 *     summary: Cria um novo agendamento
 *     tags: [Agenda Pública]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slug:
 *                 type: string
 *                 example: studio-beauty
 *               servico_id:
 *                 type: integer
 *                 example: 1
 *               profissional_id:
 *                 type: integer
 *                 example: 5
 *               data:
 *                 type: string
 *                 example: 2026-07-10
 *               horario:
 *                 type: string
 *                 example: 14:00
 *               cliente_nome:
 *                 type: string
 *                 example: Maria Silva
 *               cliente_whatsapp:
 *                 type: string
 *                 example: 62999999999
 *     responses:
 *       201:
 *         description: Agendamento criado
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Horário indisponível
 */

router.post(
  "/agendamentos",
  optionalAuth,
  agendaPublicaController.criarAgendamentoPublico
);

/**
 * @swagger
 * /meus-agendamentos:
 *   get:
 *     summary: Lista os agendamentos do usuário logado
 *     tags: [Agenda Pública]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *       401:
 *         description: Não autenticado
 */

router.get(
  "/meus-agendamentos",
  auth,
  agendaPublicaController.listarMeusAgendamentos
);

/**
 * @swagger
 * /agendamentos/{id}/cancelar:
 *   patch:
 *     summary: Cancela um agendamento
 *     tags: [Agenda Pública]
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
 *         description: Agendamento cancelado
 *       404:
 *         description: Agendamento não encontrado
 */

router.patch(
  "/agendamentos/:id/cancelar",
  auth,
  agendaPublicaController.cancelarMeuAgendamento
);

/**
 * @swagger
 * /agendamentos/{id}/avaliar:
 *   patch:
 *     summary: Avalia um atendimento realizado
 *     tags: [Agenda Pública]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avaliacao:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *     responses:
 *       200:
 *         description: Avaliação registrada
 *       400:
 *         description: Dados inválidos
 */

router.patch(
  "/agendamentos/:id/avaliar",
  auth,
  agendaPublicaController.avaliarAgendamento
);

module.exports = router;