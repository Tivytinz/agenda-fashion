const dashboardRepository = require(
  "../repositories/dashboardRepository"
);

const AppError = require(
  "../errors/AppError"
);

function criarErro(
  mensagem,
  statusCode
) {
  return new AppError(
    mensagem,
    statusCode
  );
}

function converterNumero(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero)
  ) {
    return 0;
  }

  return numero;
}

function normalizarNegocio(
  negocio
) {
  if (!negocio) {
    return null;
  }

  return {
    negocio_id:
      converterNumero(
        negocio.negocio_id
      ),

    papel:
      negocio.papel,

    nome:
      negocio.nome,

    slug:
      negocio.slug,
  };
}

function normalizarAtendimento(
  atendimento
) {
  if (!atendimento) {
    return null;
  }

  return {
    id:
      converterNumero(
        atendimento.id
      ),

    data:
      atendimento.data,

    horario:
      atendimento.horario,

    status:
      atendimento.status,

    hoje:
      Boolean(
        atendimento.hoje
      ),

    cliente: {
      id:
        atendimento.cliente_id
          ? converterNumero(
              atendimento.cliente_id
            )
          : null,

      nome:
        atendimento.cliente_nome,

      whatsapp:
        atendimento.cliente_whatsapp ||
        null,
    },

    servico: {
      id:
        atendimento.servico_id
          ? converterNumero(
              atendimento.servico_id
            )
          : null,

      nome:
        atendimento.servico_nome,

      valor:
        converterNumero(
          atendimento.valor
        ),

      duracao_minutos:
        converterNumero(
          atendimento.duracao_minutos
        ),
    },
  };
}

function normalizarServico(
  servico
) {
  return {
    id:
      servico.id
        ? converterNumero(
            servico.id
          )
        : null,

    nome:
      servico.nome,

    total:
      converterNumero(
        servico.total
      ),

    faturamento:
      converterNumero(
        servico.faturamento
      ),
  };
}

function normalizarPeriodo(periodo) {
  const aliases = {
    hoje: "hoje",
    "7": "7dias",
    "7dias": "7dias",
    "30": "30dias",
    "30dias": "30dias",
    mes: "mes",
    month: "mes"
  };

  return aliases[periodo] || "7dias";
}

function filtroPeriodo(
  periodo,
  expressaoData = "a.data"
) {
  const hojeBrasil =
    `(NOW() AT TIME ZONE ` +
    `'America/Sao_Paulo')::date`;
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  if (
    periodoNormalizado === "hoje"
  ) {
    return (
      `AND ${expressaoData} = ` +
      hojeBrasil
    );
  }

  if (
    periodoNormalizado === "7dias"
  ) {
    return (
      `AND ${expressaoData} BETWEEN ` +
      `${hojeBrasil} - ` +
      `INTERVAL '6 days' ` +
      `AND ${hojeBrasil}`
    );
  }

  if (
    periodoNormalizado === "30dias"
  ) {
    return (
      `AND ${expressaoData} BETWEEN ` +
      `${hojeBrasil} - ` +
      `INTERVAL '29 days' ` +
      `AND ${hojeBrasil}`
    );
  }

  if (periodoNormalizado === "mes") {
    return (
      `AND ${expressaoData} BETWEEN ` +
      `date_trunc('month', ${hojeBrasil})::date ` +
      `AND ${hojeBrasil}`
    );
  }

  return filtroPeriodo("7dias", expressaoData);
}

async function buscarDashboardProfissional({
  usuarioId,
}) {
  if (!usuarioId) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio =
    await dashboardRepository
      .buscarNegocioDoUsuario(
        usuarioId
      );

  if (!negocio) {
    throw criarErro(
      "Usuário não está vinculado a nenhum negócio.",
      404
    );
  }

  const negocioId =
    converterNumero(
      negocio.negocio_id
    );

  const [
    resumo,
    proximoAtendimento,
    proximosAtendimentos,
    servicosMaisVendidos,
  ] = await Promise.all([
    dashboardRepository
      .buscarResumoProfissional(
        negocioId,
        usuarioId
      ),

    dashboardRepository
      .buscarProximoAtendimentoProfissional(
        negocioId,
        usuarioId
      ),

    dashboardRepository
      .listarProximosAtendimentosProfissional(
        negocioId,
        usuarioId,
        5
      ),

    dashboardRepository
      .buscarServicosMaisVendidosProfissional(
        negocioId,
        usuarioId
      ),
  ]);

  const agendamentosHoje =
    converterNumero(
      resumo.agendamentos_hoje ??
      resumo.agendados_hoje
    );

  return {
    negocio:
      normalizarNegocio(
        negocio
      ),

    resumo: {
      total_agendados:
        converterNumero(
          resumo.total_agendados
        ),

      agendados_hoje:
        agendamentosHoje,

      agendamentos_hoje:
        agendamentosHoje,

      cancelamentos_hoje:
        converterNumero(
          resumo.cancelamentos_hoje
        ),

      realizados_hoje:
        converterNumero(
          resumo.realizados_hoje
        ),

      pendentes_hoje:
        converterNumero(
          resumo.pendentes_hoje
        ),

      clientes_unicos:
        converterNumero(
          resumo.clientes_unicos
        ),

      faturamento_estimado:
        converterNumero(
          resumo.faturamento_estimado
        ),

      faturamento_previsto_hoje:
        converterNumero(
          resumo
            .faturamento_previsto_hoje
        ),
    },

    proximo_atendimento:
      normalizarAtendimento(
        proximoAtendimento
      ),

    proximos_atendimentos:
      proximosAtendimentos.map(
        normalizarAtendimento
      ),

    servicos_mais_vendidos:
      servicosMaisVendidos.map(
        normalizarServico
      ),
  };
}

async function buscarDashboardDono({
  usuarioId,
  periodo = "7dias",
}) {
  if (!usuarioId) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio =
    await dashboardRepository
      .buscarNegocioDoUsuario(
        usuarioId
      );

  if (!negocio) {
    throw criarErro(
      "Usuário não está vinculado a nenhum negócio.",
      404
    );
  }

  if (
    negocio.papel !== "dono"
  ) {
    throw criarErro(
      "Apenas o dono pode acessar este dashboard.",
      403
    );
  }

  const negocioId =
    converterNumero(
      negocio.negocio_id
    );

  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const filtro =
    filtroPeriodo(
      periodoNormalizado
    );

  const filtroEventos =
    filtroPeriodo(
      periodoNormalizado,
      `(e.created_at AT TIME ZONE ` +
      `'America/Sao_Paulo')::date`
    );

  const filtroFavoritos =
    filtroPeriodo(
      periodoNormalizado,
      `(f.created_at AT TIME ZONE ` +
      `'America/Sao_Paulo')::date`
    );

  const [
    resumo,
    clientesRecorrentes,
    performance,
    favoritos,
    resumoDias,
    rankingProfissionais,
    rankingServicos,
    rankingClientes,
  ] = await Promise.all([
    dashboardRepository
      .buscarResumoDono(
        negocioId,
        filtro
      ),

    dashboardRepository
      .buscarClientesRecorrentes(
        negocioId
      ),

    dashboardRepository
      .buscarPerformanceNegocio(
        negocioId,
        filtroEventos
      ),

    dashboardRepository
      .buscarFavoritosRecebidos(
        negocioId,
        filtroFavoritos
      ),

    dashboardRepository
      .buscarResumoDias(
        negocioId,
        filtro
      ),

    dashboardRepository
      .buscarRankingProfissionais(
        negocioId,
        filtro
      ),

    dashboardRepository
      .buscarRankingServicos(
        negocioId,
        filtro
      ),

    dashboardRepository
      .buscarRankingClientes(
        negocioId,
        filtro
      ),
  ]);

  const totalVisitas =
    converterNumero(
      performance.visitas_perfil
    );

  const agendamentosConvertidos =
    converterNumero(
      performance
        .agendamentos_concluidos
    );

  const agendamentosPeriodo =
    converterNumero(
      resumo.agendamentos_periodo
    );

  const faturamentoPeriodo =
    converterNumero(
      resumo.faturamento_periodo
    );

  const taxaConversao =
    totalVisitas > 0
      ? Number(
          ((
            agendamentosConvertidos /
            totalVisitas
          ) * 100).toFixed(1)
        )
      : 0;

  const ticketMedio =
    agendamentosPeriodo > 0
      ? Number(
          (
            faturamentoPeriodo /
            agendamentosPeriodo
          ).toFixed(2)
        )
      : 0;

  return {
    periodo:
      periodoNormalizado,

    negocio:
      normalizarNegocio(
        negocio
      ),

    resumo: {
      agendamentos_hoje:
        converterNumero(
          resumo.agendamentos_hoje
        ),

      agendamentos_periodo:
        agendamentosPeriodo,

      faturamento_hoje:
        converterNumero(
          resumo.faturamento_hoje
        ),

      faturamento_periodo:
        faturamentoPeriodo,

      clientes_novos:
        converterNumero(
          resumo.clientes_novos
        ),

      clientes_recorrentes:
        converterNumero(
          clientesRecorrentes
        ),

      servicos_vendidos:
        converterNumero(
          resumo.servicos_vendidos
        ),

      ticket_medio:
        ticketMedio,
    },

    performance: {
      visitas_perfil:
        totalVisitas,

      cliques_whatsapp:
        converterNumero(
          performance
            .cliques_whatsapp
        ),

      cliques_maps:
        converterNumero(
          performance
            .cliques_maps
        ),

      favoritos_recebidos:
        converterNumero(
          favoritos
        ),

      agendamentos_concluidos:
        agendamentosConvertidos,

      taxa_conversao:
        taxaConversao,
    },

    resumo_dias:
      resumoDias,

    ranking_profissionais:
      rankingProfissionais,

    ranking_servicos:
      rankingServicos,

    ranking_clientes:
      rankingClientes,
  };
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono,
};
