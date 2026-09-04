const AppError = require("../errors/AppError");
const dashboardDonoService = require("./dashboardDonoService");
const {
  buildCopilotShareContext,
} = require("./copilot/copilotContextService");
const {
  sanitizeCopilotShareOutput,
  buildFallbackShareOutput,
} = require("./copilot/copilotOutputService");
const openaiProvider = require("./copilot/openaiProvider");

const PERIODOS_PERMITIDOS = new Set(["hoje", "7dias", "30dias", "mes"]);
const CANAIS_PERMITIDOS = new Set(["whatsapp"]);

function normalizarPeriodo(periodo) {
  const valor = String(periodo || "7dias").trim();
  return PERIODOS_PERMITIDOS.has(valor) ? valor : "7dias";
}

function normalizarCanal(canal) {
  const valor = String(canal || "whatsapp").trim().toLowerCase();
  if (!CANAIS_PERMITIDOS.has(valor)) {
    throw new AppError("Canal de divulgação inválido.", 400);
  }
  return valor;
}

function validarOportunidadeCompartilhamento(inteligencia) {
  const oportunidade = inteligencia?.oportunidade_principal;

  if (
    inteligencia?.status !== "OPORTUNIDADE_PRIORIZADA" ||
    oportunidade?.acao?.tipo !== "COMPARTILHAR_PERFIL"
  ) {
    throw new AppError(
      "Ainda não há uma oportunidade de divulgação priorizada para este negócio.",
      409
    );
  }

  return oportunidade;
}

async function gerarDivulgacao({ usuarioId, periodo, canal } = {}) {
  if (!usuarioId) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  const canalNormalizado = normalizarCanal(canal);
  const dashboard = await dashboardDonoService.buscarDashboardDono({
    usuarioId,
    periodo: normalizarPeriodo(periodo),
  });

  const oportunidade = validarOportunidadeCompartilhamento(
    dashboard.inteligencia_crescimento
  );

  const contexto = buildCopilotShareContext({
    dashboard,
    oportunidade,
  });

  if (openaiProvider.isEnabled()) {
    try {
      const saidaIa = sanitizeCopilotShareOutput(
        await openaiProvider.generateShareCopy(contexto)
      );

      if (saidaIa) {
        return {
          canal: canalNormalizado,
          fonte: "openai",
          oportunidade: oportunidade.codigo,
          ...saidaIa,
        };
      }
    } catch {
      // A IA é assistiva. Falha de provedor ou contrato nunca bloqueia a divulgação.
    }
  }

  return {
    canal: canalNormalizado,
    fonte: "fallback",
    oportunidade: oportunidade.codigo,
    ...buildFallbackShareOutput(contexto),
  };
}

module.exports = {
  gerarDivulgacao,
  normalizarPeriodo,
  normalizarCanal,
  validarOportunidadeCompartilhamento,
};
