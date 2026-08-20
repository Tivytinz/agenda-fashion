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

  const agendamentosConcluidos =
    inteiro(
      item?.agendamentos_concluidos
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
    agendamentosConcluidos,
    custoPorSessaoCentavos:
      custoUnitario(
        investimentoCentavos,
        sessoes
      ),
    cpaCentavos:
      objetivo === "cliente"
        ? custoUnitario(
            investimentoCentavos,
            agendamentosConcluidos
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

  const linhas =
    await adminMarketingCostRepository
      .listarDesempenho(
        periodoNormalizado
      );

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

      return {
        investimentoCentavos:
          acumulado.investimentoCentavos +
          campanha.investimentoCentavos,
        sessoes:
          acumulado.sessoes +
          campanha.sessoes,
        investimentoClientesCentavos:
          acumulado.investimentoClientesCentavos +
          (cliente
            ? campanha.investimentoCentavos
            : 0),
        agendamentosClientesConcluidos:
          acumulado.agendamentosClientesConcluidos +
          (cliente
            ? campanha.agendamentosConcluidos
            : 0),
      };
    },
    {
      investimentoCentavos: 0,
      sessoes: 0,
      investimentoClientesCentavos: 0,
      agendamentosClientesConcluidos: 0,
    }
  );

  return {
    periodo:
      periodoNormalizado,
    moeda: "BRL",
    investimentoCentavos:
      totais.investimentoCentavos,
    sessoes:
      totais.sessoes,
    agendamentosConcluidos:
      totais.agendamentosClientesConcluidos,
    investimentoClientesCentavos:
      totais.investimentoClientesCentavos,
    custoPorSessaoCentavos:
      custoUnitario(
        totais.investimentoCentavos,
        totais.sessoes
      ),
    cpaCentavos:
      custoUnitario(
        totais.investimentoClientesCentavos,
        totais.agendamentosClientesConcluidos
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
  normalizarData,
  normalizarValorCentavos,
  normalizarPeriodo,
  mapearDesempenho,
};
