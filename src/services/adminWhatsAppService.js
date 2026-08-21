const adminWhatsAppRepository =
  require(
    "../repositories/adminWhatsAppRepository"
  );
const whatsappProvider = require(
  "../providers/whatsappProvider"
);
const {
  configuracaoBooleana,
  listarTemplatesConfigurados,
} = require(
  "../config/whatsappTemplates"
);

const PERIODOS = Object.freeze({
  hoje: "Hoje",
  7: "7 dias",
  30: "30 dias",
  90: "90 dias",
  total: "Todo o período",
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function percentual(
  numerador,
  denominador
) {
  if (denominador <= 0) {
    return null;
  }

  return Number(
    (
      (numerador / denominador) *
      100
    ).toFixed(1)
  );
}

function normalizarPeriodo(valor) {
  const periodo = String(
    valor ||
    "30"
  ).trim();

  return Object.hasOwn(
    PERIODOS,
    periodo
  )
    ? periodo
    : "30";
}

function normalizarIdioma(valor) {
  return String(valor || "")
    .trim()
    .replace(/-/g, "_")
    .toLowerCase();
}

function obterQualidade(template) {
  const qualidade =
    template?.quality_score;

  if (
    qualidade &&
    typeof qualidade === "object"
  ) {
    return String(
      qualidade.score ||
      qualidade.value ||
      "UNKNOWN"
    ).toUpperCase();
  }

  return String(
    qualidade ||
    "UNKNOWN"
  ).toUpperCase();
}

function mensagemFalhaMeta(erro) {
  if (
    erro?.response?.status === 401 ||
    erro?.response?.status === 403
  ) {
    return "A Meta recusou a consulta. Verifique o token permanente e as permissões de gerenciamento do WhatsApp.";
  }

  if (erro?.response?.status === 429) {
    return "A Meta limitou temporariamente as consultas. Tente atualizar novamente em alguns minutos.";
  }

  return "Não foi possível consultar a Meta agora. As métricas locais continuam disponíveis.";
}

function configuracaoSegura(
  ambiente = process.env
) {
  return {
    notificacoesHabilitadas:
      configuracaoBooleana(
        ambiente.WHATSAPP_NOTIFICATIONS_ENABLED,
        false
      ),
    tokenConfigurado: Boolean(
      String(
        ambiente.WHATSAPP_ACCESS_TOKEN ||
        ""
      ).trim()
    ),
    telefoneConfigurado: Boolean(
      String(
        ambiente.WHATSAPP_PHONE_NUMBER_ID ||
        ""
      ).trim()
    ),
    contaWhatsappConfigurada: Boolean(
      String(
        ambiente.WHATSAPP_BUSINESS_ACCOUNT_ID ||
        ""
      ).trim()
    ),
    versaoApiConfigurada: Boolean(
      String(
        ambiente.WHATSAPP_API_VERSION ||
        ""
      ).trim()
    ),
    idioma:
      String(
        ambiente.WHATSAPP_TEMPLATE_LANGUAGE ||
        "pt_BR"
      ).trim(),
  };
}

async function consultarMeta(
  configuracao
) {
  const ausentes = [];

  if (!configuracao.tokenConfigurado) {
    ausentes.push(
      "WHATSAPP_ACCESS_TOKEN"
    );
  }
  if (!configuracao.contaWhatsappConfigurada) {
    ausentes.push(
      "WHATSAPP_BUSINESS_ACCOUNT_ID"
    );
  }
  if (!configuracao.versaoApiConfigurada) {
    ausentes.push(
      "WHATSAPP_API_VERSION"
    );
  }

  if (ausentes.length > 0) {
    return {
      verificacao: {
        disponivel: false,
        consultadoEm: null,
        codigo: "CONFIGURACAO_INCOMPLETA",
        mensagem:
          "Configure a conta do WhatsApp para verificar os templates diretamente na Meta.",
        variaveisAusentes: ausentes,
      },
      templates: [],
    };
  }

  try {
    const templates =
      await whatsappProvider
        .listarTemplates();

    return {
      verificacao: {
        disponivel: true,
        consultadoEm:
          new Date().toISOString(),
        codigo: "CONSULTA_CONCLUIDA",
        mensagem:
          "Status consultado diretamente na Meta.",
        variaveisAusentes: [],
      },
      templates,
    };
  } catch (erro) {
    return {
      verificacao: {
        disponivel: false,
        consultadoEm:
          new Date().toISOString(),
        codigo: "META_INDISPONIVEL",
        mensagem:
          mensagemFalhaMeta(erro),
        variaveisAusentes: [],
      },
      templates: [],
    };
  }
}

function metricasVazias() {
  return {
    total: 0,
    pendentes: 0,
    aceitas: 0,
    entregues: 0,
    lidas: 0,
    falhasFila: 0,
    falhasEntrega: 0,
    canceladas: 0,
    taxaEntrega: null,
    taxaLeitura: null,
  };
}

function mapearMetricas(linha) {
  const metricas = {
    total: numero(linha?.total),
    pendentes: numero(linha?.pendentes),
    aceitas: numero(linha?.aceitas),
    entregues: numero(linha?.entregues),
    lidas: numero(linha?.lidas),
    falhasFila: numero(linha?.falhas_fila),
    falhasEntrega:
      numero(linha?.falhas_entrega),
    canceladas: numero(linha?.canceladas),
  };

  return {
    ...metricas,
    taxaEntrega: percentual(
      metricas.entregues,
      metricas.aceitas
    ),
    taxaLeitura: percentual(
      metricas.lidas,
      metricas.entregues
    ),
  };
}

function somarMetricas(templates) {
  const total = templates.reduce(
    (acumulado, template) => {
      for (
        const campo of [
          "total",
          "pendentes",
          "aceitas",
          "entregues",
          "lidas",
          "falhasFila",
          "falhasEntrega",
          "canceladas",
        ]
      ) {
        acumulado[campo] +=
          template.metricas[campo];
      }

      return acumulado;
    },
    metricasVazias()
  );

  total.taxaEntrega = percentual(
    total.entregues,
    total.aceitas
  );
  total.taxaLeitura = percentual(
    total.lidas,
    total.entregues
  );

  return total;
}

function encontrarTemplateMeta(
  templateConfigurado,
  templatesMeta
) {
  const mesmoNome = templatesMeta.filter(
    (template) =>
      String(template?.name || "")
        .trim()
        .toLowerCase() ===
      templateConfigurado.nome
        .toLowerCase()
  );

  return {
    mesmoNome,
    exato: mesmoNome.find(
      (template) =>
        normalizarIdioma(
          template?.language
        ) ===
        normalizarIdioma(
          templateConfigurado.idioma
        )
    ) || null,
  };
}

function mapearTemplate({
  configurado,
  linhaMetricas,
  templatesMeta,
  metaDisponivel,
}) {
  const localizado = encontrarTemplateMeta(
    configurado,
    templatesMeta
  );
  const remoto = localizado.exato;
  const statusMeta = remoto
    ? String(
        remoto.status ||
        "UNKNOWN"
      ).toUpperCase()
    : metaDisponivel
      ? localizado.mesmoNome.length > 0
        ? "IDIOMA_AUSENTE"
        : "AUSENTE"
      : "NAO_VERIFICADO";
  const categoriaMeta = remoto
    ? String(
        remoto.category ||
        ""
      ).toUpperCase()
    : null;
  const categoriaConforme =
    remoto
      ? categoriaMeta ===
        configurado.categoriaEsperada
      : null;

  return {
    ...configurado,
    statusMeta,
    categoriaMeta,
    categoriaConforme,
    qualidadeMeta: remoto
      ? obterQualidade(remoto)
      : null,
    templateMetaId: remoto?.id
      ? String(remoto.id)
      : null,
    saude:
      !metaDisponivel
        ? "NAO_VERIFICADO"
        : statusMeta === "APPROVED" &&
          categoriaConforme
          ? "SAUDAVEL"
          : "ATENCAO",
    metricas: linhaMetricas
      ? mapearMetricas(linhaMetricas)
      : metricasVazias(),
  };
}

async function buscarPainel({
  periodo: periodoRecebido,
} = {}) {
  const periodo = normalizarPeriodo(
    periodoRecebido
  );
  const configuracao =
    configuracaoSegura();

  const [linhasMetricas, meta] =
    await Promise.all([
      adminWhatsAppRepository
        .buscarMetricasPorTemplate(
          periodo
        ),
      consultarMeta(
        configuracao
      ),
    ]);

  const metricasPorTipo = new Map(
    linhasMetricas.map(
      (linha) => [
        linha.tipo,
        linha,
      ]
    )
  );
  const templates =
    listarTemplatesConfigurados()
      .map(
        (configurado) =>
          mapearTemplate({
            configurado,
            linhaMetricas:
              metricasPorTipo.get(
                configurado.tipo
              ),
            templatesMeta:
              meta.templates,
            metaDisponivel:
              meta.verificacao.disponivel,
          })
      );
  const totais = somarMetricas(
    templates
  );
  const aprovadosMeta =
    meta.verificacao.disponivel
      ? templates.filter(
          (template) =>
            template.statusMeta ===
              "APPROVED"
        ).length
      : null;

  return {
    periodo: {
      valor: periodo,
      rotulo: PERIODOS[periodo],
    },
    configuracao,
    verificacaoMeta:
      meta.verificacao,
    resumo: {
      templatesEsperados:
        templates.length,
      templatesAprovadosMeta:
        aprovadosMeta,
      templatesComAtencao:
        aprovadosMeta === null
          ? null
          : templates.filter(
              (template) =>
                template.saude ===
                "ATENCAO"
            ).length,
      automacoesHabilitadas:
        templates.filter(
          (template) =>
            template.automacaoHabilitada
        ).length,
      ...totais,
    },
    templates,
  };
}

module.exports = {
  buscarPainel,
  normalizarPeriodo,
};
