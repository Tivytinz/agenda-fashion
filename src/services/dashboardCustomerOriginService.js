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
  microsoft_ads: {
    rotulo: "Microsoft Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por anúncio identificado da Microsoft/Bing.",
  },
  meta_ads: {
    rotulo: "Meta Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por anúncio identificado da Meta.",
  },
  tiktok_ads: {
    rotulo: "TikTok Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por anúncio identificado do TikTok.",
  },
  pinterest_ads: {
    rotulo: "Pinterest Ads",
    categoria: "pago",
    descricao: "Cliente adquirido por anúncio identificado do Pinterest.",
  },
  outra_midia_paga: {
    rotulo: "Outra mídia paga",
    categoria: "pago",
    descricao: "Há sinal de mídia paga, mas o canal não pertence aos padrões conhecidos.",
  },
  google_organico: {
    rotulo: "Google orgânico",
    categoria: "organico",
    descricao: "Cliente chegou por resultado não pago do Google.",
  },
  bing_organico: {
    rotulo: "Bing orgânico",
    categoria: "organico",
    descricao: "Cliente chegou por resultado não pago do Bing.",
  },
  duckduckgo_organico: {
    rotulo: "DuckDuckGo orgânico",
    categoria: "organico",
    descricao: "Cliente chegou por resultado não pago do DuckDuckGo.",
  },
  yahoo_organico: {
    rotulo: "Yahoo orgânico",
    categoria: "organico",
    descricao: "Cliente chegou por resultado não pago do Yahoo.",
  },
  instagram_organico: {
    rotulo: "Instagram orgânico",
    categoria: "organico",
    descricao: "Cliente chegou pelo Instagram sem sinal de anúncio pago.",
  },
  facebook_organico: {
    rotulo: "Facebook orgânico",
    categoria: "organico",
    descricao: "Cliente chegou pelo Facebook sem sinal de anúncio pago.",
  },
  meta_organico: {
    rotulo: "Meta orgânico",
    categoria: "organico",
    descricao: "Cliente chegou por Facebook ou Instagram sem evidência suficiente de anúncio pago.",
  },
  tiktok_organico: {
    rotulo: "TikTok orgânico",
    categoria: "organico",
    descricao: "Cliente chegou pelo TikTok sem sinal de anúncio pago.",
  },
  pinterest_organico: {
    rotulo: "Pinterest orgânico",
    categoria: "organico",
    descricao: "Cliente chegou pelo Pinterest sem sinal de anúncio pago.",
  },
  referencia_externa: {
    rotulo: "Referência externa",
    categoria: "organico",
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
    descricao: "Não houve sinal de anúncio nem referência externa identificável. Pode ser acesso direto, favorito ou link compartilhado.",
  },
  nao_identificado: {
    rotulo: "Origem não identificada",
    categoria: "incompleto",
    descricao: "O agendamento existe, mas não há dados históricos suficientes para identificar a origem.",
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

function filtrarCategoria(origens, categoria) {
  return origens.filter(
    (origem) => origem.categoria === categoria
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

  const pagas = filtrarCategoria(origens, "pago");
  const organicas = filtrarCategoria(origens, "organico");
  const autonomas = filtrarCategoria(origens, "autonomo");
  const incompletas = filtrarCategoria(origens, "incompleto");

  const clientesPagos = somar(pagas, "clientes");
  const clientesOrganicos = somar(organicas, "clientes");
  const clientesAutonomos = somar(autonomas, "clientes");

  return {
    periodo: periodoNormalizado,
    resumo: {
      clientes: totalClientes,
      clientesNovos: somar(origens, "clientesNovos"),
      clientesRecorrentes: somar(origens, "clientesRecorrentes"),
      agendamentos: somar(origens, "agendamentos"),
      faturamento: somar(origens, "faturamento"),
      clientesPagos,
      clientesOrganicos,
      clientesAutonomos,
      clientesSemOrigem: somar(incompletas, "clientes"),
      agendamentosPagos: somar(pagas, "agendamentos"),
      agendamentosOrganicos: somar(organicas, "agendamentos"),
      faturamentoPago: somar(pagas, "faturamento"),
      faturamentoOrganico: somar(organicas, "faturamento"),
      percentualPago: totalClientes > 0
        ? Number(((clientesPagos / totalClientes) * 100).toFixed(1))
        : 0,
      percentualOrganico: totalClientes > 0
        ? Number(((clientesOrganicos / totalClientes) * 100).toFixed(1))
        : 0,
      percentualAutonomo: totalClientes > 0
        ? Number(((clientesAutonomos / totalClientes) * 100).toFixed(1))
        : 0,
    },
    origens,
  };
}

module.exports = {
  buscarOrigemClientes,
  normalizarLinha,
  ORIGENS,
};
