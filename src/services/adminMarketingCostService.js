const AppError = require(
  "../errors/AppError"
);

const adminCampaignRepository =
  require(
    "../repositories/adminCampaignRepository"
  );

const adminMarketingCostRepository =
  require(
    "../repositories/adminMarketingCostRepository"
  );

const PERIODOS = new Map([
  ["all", "all"],
  ["todos", "all"],
  ["today", "today"],
  ["hoje", "today"],
  ["7", "7"],
  ["7dias", "7"],
  ["30", "30"],
  ["30dias", "30"],
  ["month", "month"],
  ["mes", "month"],
  ["mês", "month"],
]);

function normalizarPeriodo(valor) {
  const periodo = String(
    valor || "30"
  )
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    );

  return PERIODOS.get(periodo) ||
    "30";
}

function inteiro(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.trunc(numero);
}

function custoUnitario(
  investimentoCentavos,
  quantidade
) {
  const investimento =
    inteiro(investimentoCentavos);

  const total = inteiro(quantidade);

  if (
    investimento <= 0 ||
    total <= 0
  ) {
    return null;
  }

  return Math.round(
    investimento / total
  );
}

function percentual(
  parte,
  total
) {
  const totalNormalizado =
    inteiro(total);

  if (totalNormalizado <= 0) {
    return null;
  }

  return Number(
    (
      (inteiro(parte) /
        totalNormalizado) *
      100
    ).toFixed(2)
  );
}

function normalizarId(valor) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      "Campanha inválida.",
      400
    );
  }

  return id;
}

function normalizarData(valor) {
  const texto = String(
    valor || ""
  ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      texto
    )
  ) {
    throw new AppError(
      "Informe a data do gasto no formato AAAA-MM-DD.",
      400
    );
  }

  const [ano, mes, dia] =
    texto
      .split("-")
      .map(Number);

  const data = new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia
    )
  );

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new AppError(
      "Data de gasto inválida.",
      400
    );
  }

  return texto;
}

function normalizarValorCentavos(
  valor
) {
  const centavos = Number(valor);

  if (
    !Number.isSafeInteger(centavos) ||
    centavos <= 0 ||
    centavos > 1000000000000
  ) {
    throw new AppError(
      "Informe um investimento válido em centavos.",
      400
    );
  }

  return centavos;
}

function normalizarObservacao(valor) {
  const observacao = String(
    valor ?? ""
  ).trim();

  if (observacao.length > 240) {
    throw new AppError(
      "A observação pode ter no máximo 240 caracteres.",
      400
    );
  }

  return observacao || null;
}

function mapearDesempenho(item) {
  const investimentoCentavos =
    inteiro(
      item?.investimento_centavos
    );

  const sessoes =
    inteiro(item?.sessoes);

  const sessoesAtribuicaoAssistida =
    Math.min(
      Math.max(0, sessoes),
      Math.max(
        0,
        inteiro(
          item?.sessoes_atribuicao_assistida
        )
      )
    );

  const sessoesComCusto =
    Math.min(
      Math.max(0, sessoes),
      Math.max(
        0,
        Object.prototype.hasOwnProperty.call(
          item || {},
          "sessoes_com_custo"
        )
          ? inteiro(
              item?.sessoes_com_custo
            )
          : investimentoCentavos > 0
            ? sessoes
            : 0
      )
    );

  const agendamentosConcluidos =
    inteiro(
      item?.agendamentos_concluidos
    );

  const agendamentosConcluidosComCusto =
    Math.min(
      Math.max(
        0,
        agendamentosConcluidos
      ),
      Math.max(
        0,
        Object.prototype.hasOwnProperty.call(
          item || {},
          "agendamentos_concluidos_com_custo"
        )
          ? inteiro(
              item
                ?.agendamentos_concluidos_com_custo
            )
          : investimentoCentavos > 0
            ? agendamentosConcluidos
            : 0
      )
    );

  const objetivo =
    String(
      item?.objetivo ||
      "indefinido"
    );

  return {
    campanhaId:
      inteiro(item?.id),
    nome:
      String(item?.nome || ""),
    canal:
      String(item?.canal || ""),
    objetivo,
    utmSource:
      String(item?.utm_source || ""),
    utmMedium:
      String(item?.utm_medium || ""),
    utmCampaign:
      String(item?.utm_campaign || ""),
    ativo:
      item?.ativo !== false,
    investimentoCentavos,
    sessoes,
    sessoesAtribuicaoDireta:
      Math.max(
        0,
        sessoes -
          sessoesAtribuicaoAssistida
      ),
    sessoesAtribuicaoAssistida,
    sessoesComCusto,
    sessoesSemCusto:
      Math.max(
        0,
        sessoes - sessoesComCusto
      ),
    coberturaCustos:
      percentual(
        sessoesComCusto,
        sessoes
      ),
    agendamentosConcluidos,
    agendamentosConcluidosComCusto,
    agendamentosConcluidosSemCusto:
      Math.max(
        0,
        agendamentosConcluidos -
          agendamentosConcluidosComCusto
      ),
    coberturaCustosConversoes:
      percentual(
        agendamentosConcluidosComCusto,
        agendamentosConcluidos
      ),
    custoPorSessaoCentavos:
      custoUnitario(
        investimentoCentavos,
        sessoesComCusto
      ),
    cpaCentavos:
      objetivo === "cliente"
        ? custoUnitario(
            investimentoCentavos,
            agendamentosConcluidosComCusto
          )
        : null,
  };
}

function mapearGasto(item) {
  return {
    id: inteiro(item?.id),
    campanhaId:
      inteiro(item?.campanha_id),
    campanhaNome:
      item?.campanha_nome || null,
    canal:
      item?.canal || null,
    objetivo:
      item?.objetivo ||
      "indefinido",
    utmSource:
      item?.utm_source || null,
    utmMedium:
      item?.utm_medium || null,
    utmCampaign:
      item?.utm_campaign || null,
    dataGasto:
      item?.data_gasto instanceof Date
        ? item.data_gasto
            .toISOString()
            .slice(0, 10)
        : String(
            item?.data_gasto || ""
          ).slice(0, 10),
    valorCentavos:
      inteiro(item?.valor_centavos),
    moeda:
      item?.moeda || "BRL",
    fonte:
      item?.fonte || "manual",
    observacao:
      item?.observacao || null,
    updatedAt:
      item?.updated_at || null,
  };
}

async function buscarCustos({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(periodo);

  const [
    linhas,
    diagnosticoBruto,
  ] = await Promise.all([
    adminMarketingCostRepository
      .listarDesempenho(
        periodoNormalizado
      ),
    adminMarketingCostRepository
      .buscarDiagnosticoAtribuicao(
        periodoNormalizado
      ),
  ]);

  const campanhas =
    (Array.isArray(linhas)
      ? linhas
      : []
    ).map(mapearDesempenho);

  const totais = campanhas.reduce(
    (acumulado, campanha) => {
      const cliente =
        campanha.objetivo ===
        "cliente";
      const profissional =
        campanha.objetivo ===
        "profissional";

      return {
        investimentoCentavos:
          acumulado.investimentoCentavos +
          campanha.investimentoCentavos,
        sessoes:
          acumulado.sessoes +
          campanha.sessoes,
        sessoesComCusto:
          acumulado.sessoesComCusto +
          campanha.sessoesComCusto,
        sessoesAtribuicaoAssistida:
          acumulado.sessoesAtribuicaoAssistida +
          campanha.sessoesAtribuicaoAssistida,
        investimentoClientesCentavos:
          acumulado.investimentoClientesCentavos +
          (cliente
            ? campanha.investimentoCentavos
            : 0),
        investimentoProfissionaisCentavos:
          acumulado.investimentoProfissionaisCentavos +
          (profissional
            ? campanha.investimentoCentavos
            : 0),
        campanhasComInvestimento:
          acumulado.campanhasComInvestimento +
          (
            campanha.investimentoCentavos > 0
              ? 1
              : 0
          ),
        agendamentosClientesConcluidos:
          acumulado.agendamentosClientesConcluidos +
          (cliente
            ? campanha.agendamentosConcluidos
            : 0),
        agendamentosClientesComCusto:
          acumulado.agendamentosClientesComCusto +
          (cliente
            ? campanha.agendamentosConcluidosComCusto
            : 0),
      };
    },
    {
      investimentoCentavos: 0,
      sessoes: 0,
      sessoesComCusto: 0,
      sessoesAtribuicaoAssistida: 0,
      investimentoClientesCentavos: 0,
      investimentoProfissionaisCentavos: 0,
      campanhasComInvestimento: 0,
      agendamentosClientesConcluidos: 0,
      agendamentosClientesComCusto: 0,
    }
  );

  const sessoesSemCampanha =
    inteiro(
      diagnosticoBruto
        ?.sessoes_sem_campanha
    );

  const sessoesIdentidadeNaoOficial =
    inteiro(
      diagnosticoBruto
        ?.sessoes_identidade_nao_oficial
    );

  const sessoesOficiais =
    Object.prototype.hasOwnProperty.call(
      diagnosticoBruto || {},
      "sessoes_oficiais"
    )
      ? inteiro(
          diagnosticoBruto
            .sessoes_oficiais
        )
      : totais.sessoes;

  const sessoesAtribuicaoAssistida =
    Math.min(
      sessoesOficiais,
      Object.prototype.hasOwnProperty.call(
        diagnosticoBruto || {},
        "sessoes_atribuicao_assistida"
      )
        ? inteiro(
            diagnosticoBruto
              .sessoes_atribuicao_assistida
          )
        : totais.sessoesAtribuicaoAssistida
    );

  const sessoesAtribuicaoDireta =
    Math.max(
      0,
      sessoesOficiais -
        sessoesAtribuicaoAssistida
    );

  const sessoesPagasDetectadas =
    sessoesOficiais +
    sessoesSemCampanha +
    sessoesIdentidadeNaoOficial;

  const coberturaAtribuicaoPaga =
    percentual(
      sessoesOficiais,
      sessoesPagasDetectadas
    );

  const sessoesComCusto =
    Math.min(
      totais.sessoesComCusto,
      sessoesOficiais
    );

  const sessoesOficiaisSemCusto =
    Math.max(
      0,
      sessoesOficiais -
        sessoesComCusto
    );

  const coberturaCustos =
    percentual(
      sessoesComCusto,
      sessoesOficiais
    );

  const agendamentosClientesSemCusto =
    Math.max(
      0,
      totais.agendamentosClientesConcluidos -
        totais.agendamentosClientesComCusto
    );

  const coberturaCustosClientes =
    percentual(
      totais.agendamentosClientesComCusto,
      totais.agendamentosClientesConcluidos
    );

  return {
    periodo:
      periodoNormalizado,
    moeda: "BRL",
    investimentoCentavos:
      totais.investimentoCentavos,
    sessoes:
      sessoesOficiais,
    sessoesOficiais:
      sessoesOficiais,
    sessoesAtribuicaoDireta,
    sessoesAtribuicaoAssistida,
    sessoesComCusto,
    sessoesOficiaisSemCusto,
    coberturaCustos,
    sessoesPagasDetectadas,
    coberturaAtribuicaoPaga,
    sessoesSemCampanha,
    sessoesIdentidadeNaoOficial,
    diagnosticoAtribuicao: {
      sessoesOficiais:
        sessoesOficiais,
      sessoesAtribuicaoDireta,
      sessoesAtribuicaoAssistida,
      sessoesSemCampanha,
      sessoesIdentidadeNaoOficial,
      sessoesPagasDetectadas,
      coberturaAtribuicaoPaga,
    },
    agendamentosConcluidos:
      totais.agendamentosClientesConcluidos,
    agendamentosClientesComCusto:
      totais.agendamentosClientesComCusto,
    agendamentosClientesSemCusto,
    coberturaCustosClientes,
    investimentoClientesCentavos:
      totais.investimentoClientesCentavos,
    investimentoProfissionaisCentavos:
      totais.investimentoProfissionaisCentavos,
    campanhasComInvestimento:
      totais.campanhasComInvestimento,
    diagnosticoCustos: {
      sessoesOficiais,
      sessoesComCusto,
      sessoesOficiaisSemCusto,
      coberturaCustos,
      agendamentosClientes:
        totais.agendamentosClientesConcluidos,
      agendamentosClientesComCusto:
        totais.agendamentosClientesComCusto,
      agendamentosClientesSemCusto,
      coberturaCustosClientes,
    },
    custoPorSessaoCentavos:
      custoUnitario(
        totais.investimentoCentavos,
        sessoesComCusto
      ),
    cpaCentavos:
      custoUnitario(
        totais.investimentoClientesCentavos,
        totais.agendamentosClientesComCusto
      ),
    campanhas,
  };
}

async function listarGastos({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(periodo);

  const gastos =
    await adminMarketingCostRepository
      .listarGastos(
        periodoNormalizado
      );

  return {
    periodo:
      periodoNormalizado,
    moeda: "BRL",
    gastos:
      (Array.isArray(gastos)
        ? gastos
        : []
      ).map(mapearGasto),
  };
}

async function registrarGasto({
  payload,
  usuarioId,
}) {
  const campanhaId =
    normalizarId(
      payload?.campanhaId ??
      payload?.campanha_id
    );

  const campanha =
    await adminCampaignRepository
      .buscarPorId(campanhaId);

  if (!campanha) {
    throw new AppError(
      "Campanha não encontrada.",
      404
    );
  }

  if (campanha.ativo === false) {
    throw new AppError(
      "Campanhas arquivadas não podem receber novos investimentos.",
      409
    );
  }

  if (![
    "profissional",
    "cliente",
  ].includes(campanha.objetivo)) {
    throw new AppError(
      "Classifique o objetivo da campanha antes de registrar investimentos.",
      409
    );
  }

  const gasto =
    await adminMarketingCostRepository
      .salvarGastoManual({
        campanhaId,
        dataGasto:
          normalizarData(
            payload?.dataGasto ??
            payload?.data_gasto
          ),
        valorCentavos:
          normalizarValorCentavos(
            payload?.valorCentavos ??
            payload?.valor_centavos
          ),
        observacao:
          normalizarObservacao(
            payload?.observacao
          ),
        usuarioId:
          normalizarId(usuarioId),
      });

  return {
    gasto: {
      ...mapearGasto(gasto),
      campanhaNome:
        campanha.nome,
      canal:
        campanha.canal,
      objetivo:
        campanha.objetivo ||
        "indefinido",
      utmSource:
        campanha.utm_source,
      utmMedium:
        campanha.utm_medium,
      utmCampaign:
        campanha.utm_campaign,
    },
  };
}

module.exports = {
  buscarCustos,
  listarGastos,
  registrarGasto,
  custoUnitario,
  percentual,
  normalizarData,
  normalizarValorCentavos,
  normalizarPeriodo,
  mapearDesempenho,
};
