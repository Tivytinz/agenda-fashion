function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function percentual(parte, total) {
  if (!total) return 0;
  return Number(
    ((parte / total) * 100).toFixed(2)
  );
}

function taxa(valor, parte, total) {
  if (
    valor !== null &&
    valor !== undefined &&
    Number.isFinite(Number(valor))
  ) {
    return Number(valor);
  }

  return percentual(parte, total);
}

export function buildActivationMilestones(summary = {}) {
  const cadastros = numero(summary.cadastros);

  return [
    {
      key: "cadastro",
      label: "Cadastro",
      quantidade: cadastros,
      cobertura: cadastros ? 100 : 0
    },
    {
      key: "negocio",
      label: "Negócio criado",
      quantidade: numero(summary.negociosCriados),
      cobertura: taxa(
        summary.taxaNegocio,
        summary.negociosCriados,
        cadastros
      )
    },
    {
      key: "servico",
      label: "Serviço criado",
      quantidade: numero(summary.servicosCriados),
      cobertura: taxa(
        summary.taxaServico,
        summary.servicosCriados,
        cadastros
      )
    },
    {
      key: "publicacao",
      label: "Negócio publicado",
      quantidade: numero(summary.negociosPublicados),
      cobertura: taxa(
        summary.taxaPublicacao,
        summary.negociosPublicados,
        cadastros
      )
    },
    {
      key: "agenda",
      label: "Agenda configurada",
      quantidade: numero(summary.agendasConfiguradas),
      cobertura: taxa(
        summary.taxaAgenda,
        summary.agendasConfiguradas,
        cadastros
      )
    }
  ];
}

function menorCobertura(etapas) {
  const candidatas = etapas.slice(1);
  if (!candidatas.length) return null;

  return candidatas.reduce((menor, etapa) => {
    if (!menor) return etapa;
    return etapa.cobertura <= menor.cobertura
      ? etapa
      : menor;
  }, null);
}

export function ProfessionalFunnelExecutiveOverview({
  summary = {}
}) {
  const etapas = buildActivationMilestones(summary);
  const cadastros = etapas[0]?.quantidade || 0;
  const menor = cadastros
    ? menorCobertura(etapas)
    : null;
  const ativacaoCompleta = Boolean(
    cadastros &&
    etapas.slice(1).every(
      (etapa) => etapa.cobertura >= 100
    )
  );

  let prioridadeTitulo = "Sem base para priorizar";
  let prioridadeTexto =
    "Ainda não há cadastros profissionais no período selecionado.";

  if (ativacaoCompleta) {
    prioridadeTitulo = "Ativação completa na coorte";
    prioridadeTexto =
      "Todos os cadastros do período alcançaram os marcos de ativação exibidos. O próximo diagnóstico deve olhar divulgação, primeiro agendamento e recorrência.";
  } else if (menor) {
    prioridadeTitulo = `Menor cobertura: ${menor.label}`;
    prioridadeTexto =
      `${menor.quantidade} de ${cadastros} profissionais alcançaram este marco (${menor.cobertura}% dos cadastros). Use este sinal para investigar a causa antes de mexer em aquisição ou orçamento.`;
  }

  return (
    <section
      aria-labelledby="professional-funnel-executive-title"
      className="panel"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Visão executiva</p>
          <h2 id="professional-funnel-executive-title">
            Onde a ativação está parando
          </h2>
          <p className="muted">
            Leia primeiro a cobertura dos marcos necessários para a profissional chegar a uma agenda pronta. Estes marcos são independentes, por isso a queda entre cards não é tratada como conversão sequencial.
          </p>
        </div>
      </div>

      <div
        aria-label="Cobertura dos marcos de ativação"
        className="metric-grid"
      >
        {etapas.map((etapa) => {
          const destaque = Boolean(
            menor &&
            !ativacaoCompleta &&
            etapa.key === menor.key
          );

          return (
            <article className="metric-card" key={etapa.key}>
              <span>{etapa.label}</span>
              <strong>{etapa.quantidade}</strong>
              <small>{etapa.cobertura}% dos cadastros</small>
              {destaque && (
                <span className="admin-status-badge admin-decision-badge is-revisar">
                  Menor cobertura
                </span>
              )}
            </article>
          );
        })}
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Prioridade de investigação</strong>
          <small>
            O destaque aponta o marco com menor cobertura da coorte, não prova causa nem abandono entre duas etapas.
          </small>
        </div>
        <p>
          <strong>{prioridadeTitulo}</strong>
        </p>
        <p className="muted">{prioridadeTexto}</p>
      </div>
    </section>
  );
}
