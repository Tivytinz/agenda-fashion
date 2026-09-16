const express = require("express");
const router = express.Router();
const {
  limitarAgendamento,
  limitarLeituraPublica,
} = require("../middlewares/rateLimits");

const optionalAuth = require("../middlewares/optionalAuth");
const auth = require("../middlewares/auth");
const agendaPublicaController = require("../controllers/agendamentoPublicoController");
const agendamentoVisitanteController = require(
  "../controllers/agendamentoVisitanteController"
);
const agendamentoLifecycleController = require(
  "../controllers/agendamentoLifecycleController"
);
const {
  gerarAcessoVisitante,
} = require("../utils/agendamentoVisitante");

function anexarAcessoVisitante(
  req,
  res,
  next
) {
  if (req.user?.id) {
    return next();
  }

  const responderJson =
    res.json.bind(res);

  res.json = (body) => {
    if (
      res.statusCode === 201 &&
      body?.agendamento?.id
    ) {
      return responderJson({
        ...body,
        agendamento: {
          ...body.agendamento,
          acesso_visitante:
            gerarAcessoVisitante(
              body.agendamento.id
            ),
        },
      });
    }

    return responderJson(body);
  };

  return next();
}

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
  limitarLeituraPublica,
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
 *         description: Agendamento criado. Visitantes recebem acesso_visitante dentro do agendamento.
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Horário indisponível
 */

router.post(
  "/agendamentos",
  limitarAgendamento,
  optionalAuth,
  anexarAcessoVisitante,
  agendaPublicaController.criarAgendamentoPublico
);

/**
 * @swagger
 * /meus-agendamentos:
 *   get:
 *     summary: Lista os agendamentos do usuário logado usando o status persistido
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
  agendamentoLifecycleController.listarMeusAgendamentos
);

/**
 * @swagger
 * /agendamentos/{id}/cancelar:
 *   patch:
 *     summary: Cancela um agendamento da conta autenticada
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
 * /agendamentos/{id}/cancelar-visitante:
 *   patch:
 *     summary: Cancela um agendamento visitante com a credencial emitida na criação
 *     tags: [Agenda Pública]
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
 *             required: [acesso_visitante]
 *             properties:
 *               acesso_visitante:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agendamento cancelado
 *       403:
 *         description: Credencial inválida
 *       404:
 *         description: Agendamento visitante não encontrado
 */

router.patch(
  "/agendamentos/:id/cancelar-visitante",
  limitarAgendamento,
  agendamentoVisitanteController.cancelar
);

/**
 * @swagger
 * /agendamentos/{id}/avaliar:
 *   patch:
 *     summary: Avalia um atendimento marcado como realizado
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
 *         description: Dados inválidos ou atendimento não realizado
 */

router.patch(
  "/agendamentos/:id/avaliar",
  auth,
  agendamentoLifecycleController.avaliarAgendamento
);

module.exports = router;