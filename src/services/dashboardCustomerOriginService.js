const AppError = require(
  "../errors/AppError"
);
const dashboardRepository = require(
  "../repositories/dashboardRepository"
);
const dashboardCustomerOriginRepository = require(
  "../repositories/dashboardCustomerOriginRepository"
);

const ORIGENS = Object.freeze({
  google_ads: {
    rotulo: "Google Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por clique identificado do Google Ads.",
  },
  meta_ads: {
    rotulo: "Meta Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por anúncio identificado da Meta.",
  },
  outra_midia_paga: {
    rotulo: "Outra mídia paga",
    categoria: "pago",
    descricao: "Cliente adquirido por outra mídia paga identificada.",
  },
  busca_organica: {
    rotulo: "Busca orgânica",
    categoria: "autonomo",
    descricao: "Cliente chegou por um buscador sem sinal de anúncio pago.",
  },
  social_organico: {
    rotulo: "Rede social orgânica",
    categoria: "autonomo",
    descricao: "Cliente chegou por rede social sem sinal de anúncio pago.",
  },
  referencia_externa: {
    rotulo: "Link em outro site",
    categoria: "autonomo",
    descricao: "Cliente chegou por um site externo sem sinal de mídia paga.",
  },
  outra_origem_rastreada: {
    rotulo: "Outra origem rastreada",
    categoria: "rastreado",
    descricao: "Existe origem informada, mas ela não pertence aos canais padronizados.",
  },
  autonomo: {
    rotulo: "Acesso autônomo",
    categoria: "autonomo",
    descricao: "Sem sinal de anúncio. Pode ser acesso direto, favorito ou link compartilhado.",
  },
  nao_identificado: {
    rotulo: "Origem não identificada",
    categoria: "incompleto",
    descricao: "O agendamento existe, mas não há evento de aquisição suficiente para identificar a origem.",
  },
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function normalizarLinha(linha) {
  const codigo = String(
    linha?.origem_codigo || "nao_identificado"
  ).trim();
  const meta = ORIGENS[codigo] || ORIGENS.nao_identificado;

  return {
    codigo,
    rotulo: meta.rotulo,
    categoria: meta.categoria,
    descricao: meta.descricao,
    clientes: numero(linha?.clientes),
    clientesNovos: numero(linha?.clientes_novos),
    clientesRecorrentes: numero(linha?.clientes_recorrentes),
    agendamentos: numero(linha?.agendamentos),
    faturamento: numero(linha?.faturamento),
    percentualClientes: 0,
  };
}

function somar(linhas, campo) {
  return linhas.reduce(
    (total, linha) => total + numero(linha?.[campo]),
    0
  );
}

async function buscarOrigemClientes({
  usuarioId,
  periodo,
}) {
  if (!usuarioId) {
    throw new AppError(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio = await dashboardRepository
    .buscarNegocioDoUsuario(usuarioId);

  if (!negocio) {
    throw new AppError(
      "Usuário não está vinculado a nenhum negócio.",
      404
    );
  }

  if (negocio.papel !== "dono") {
    throw new AppError(
      "Apenas o dono pode acessar a origem dos clientes.",
      403
    );
  }

  const periodoNormalizado =
    dashboardCustomerOriginRepository
      .periodoSeguro(periodo);

  const bruto = await dashboardCustomerOriginRepository
    .buscarOrigemClientes(
      Number(negocio.negocio_id),
      periodoNormalizado
    );

  const origens = (Array.isArray(bruto) ? bruto : [])
    .map(normalizarLinha);

  const totalClientes = somar(origens, "clientes");

  origens.forEach((origem) => {
    origem.percentualClientes = totalClientes > 0
      ? Number(
          ((origem.clientes / totalClientes) * 100)
            .toFixed(1)
        )
      : 0;
  });

  return {
    periodo: periodoNormalizado,
    resumo: {
      clientes: totalClientes,
      clientesNovos: somar(origens, "clientesNovos"),
      clientesRecorrentes: somar(origens, "clientesRecorrentes"),
      agendamentos: somar(origens, "agendamentos"),
      faturamento: somar(origens, "faturamento"),
      clientesPagos: origens
        .filter((origem) => origem.categoria === "pago")
        .reduce((total, origem) => total + origem.clientes, 0),
      clientesAutonomos: origens
        .filter((origem) => origem.categoria === "autonomo")
        .reduce((total, origem) => total + origem.clientes, 0),
      clientesSemOrigem: origens
        .filter((origem) => origem.categoria === "incompleto")
        .reduce((total, origem) => total + origem.clientes, 0),
    },
    origens,
  };
}

module.exports = {
  buscarOrigemClientes,
  normalizarLinha,
  ORIGENS,
};
