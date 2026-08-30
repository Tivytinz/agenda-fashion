import "./ProfessionalActivationFunnel.css";

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function percentual(parte, total) {
  if (!total) return 0;
  return Number(((parte / total) * 100).toFixed(2));
}

const PRIORIDADES = {
  "Negócio criado": {
    label: "Criação do negócio",
    action: "reduzir o abandono entre cadastro e criação do negócio"
  },
  "Serviço criado": {
    label: "Primeiro serviço",
    action: "levar negócios novos ao primeiro serviço"
  },
  "Negócio publicado": {
    label: "Publicação do perfil",
    action: "concluir os requisitos mínimos e publicar o perfil"
  },
  "Agenda configurada": {
    label: "Configuração da agenda",
    action: "conduzir perfis publicados à confirmação da agenda"
  }
};

function montarEtapas(summary) {
  const cadastros = numero(summary.cadastros);

  return [
    {
      key: "cadastro",
      label: "Cadastro",
      cardLabel: "Cadastro",
      quantidade: cadastros,
      acumulada: cadastros ? 100 : 0
    },
    {
      key: "negocio",
      label: "Negócio criado",
      cardLabel: "Negócio",
      quantidade: numero(summary.negociosCriados),
      acumulada: percentual(numero(summary.negociosCriados), cadastros)
    },
    {
      key: "servico",
      label: "Serviço criado",
      cardLabel: "Serviço",
      quantidade: numero(summary.servicosCriados),
      acumulada: percentual(numero(summary.servicosCriados), cadastros)
    },
    {
      key: "publicado",
      label: "Negócio publicado",
      cardLabel: "Perfil publicado",
      quantidade: numero(summary.negociosPublicados),
      acumulada: percentual(numero(summary.negociosPublicados), cadastros)
    },
    {
      key: "agenda",
      label: "Agenda configurada",
      cardLabel: "Agenda",
      quantidade: numero(summary.agendasConfiguradas),
      acumulada: percentual(numero(summary.agendasConfiguradas), cadastros)
    }
  ].map((etapa, index, etapas) => {
    if (index === 0) {
      return {
        ...etapa,
        conversaoAnterior: etapa.quantidade ? 100 : 0,
        perdaAnterior: 0,
        comparavel: true,
        motivoComparacao: null
      };
    }

    const anterior = etapas[index - 1];

    if (anterior.quantidade <= 0) {
      return {
        ...etapa,
        conversaoAnterior: null,
        perdaAnterior: null,
        comparavel: false,
        motivoComparacao: "sem_base"
      };
    }

    if (etapa.quantidade > anterior.quantidade) {
      return {
        ...etapa,
        conversaoAnterior: null,
        perdaAnterior: null,
        comparavel: false,
        motivoComparacao: "marco_independente"
      };
    }

    return {
      ...etapa,
      conversaoAnterior: percentual(
        etapa.quantidade,
        anterior.quantidade
      ),
      perdaAnterior: anterior.quantidade - etapa.quantidade,
      comparavel: true,
      motivoComparacao: null
    };
  });
}

function encontrarGargalo(etapas) {
  return etapas
    .slice(1)
    .filter(
      (etapa) =>
        etapa.comparavel &&
        etapa.conversaoAnterior !== null &&
        etapa.perdaAnterior > 0
    )
    .sort((a, b) => {
      if (a.conversaoAnterior !== b.conversaoAnterior) {
        return a.conversaoAnterior - b.conversaoAnterior;
      }
      return b.perdaAnterior - a.perdaAnterior;
    })[0] || null;
}

export function ProfessionalActivationFunnel({ summary = {} }) {
  const etapas = montarEtapas(summary);
  const gargalo = encontrarGargalo(etapas);
  const cadastros = etapas[0].quantidade;
  const prioridade = gargalo
    ? PRIORIDADES[gargalo.label]
    : null;

  let diagnostico =
    "Não há uma perda dominante entre os marcos comparáveis desta coorte.";

  if (cadastros === 0) {
    diagnostico =
      "Ainda não há cadastros profissionais neste período para localizar um gargalo de ativação.";
  } else if (gargalo) {
    diagnostico =
      `${gargalo.conversaoAnterior}% chegaram a “${gargalo.label}” em relação ao marco anterior. ` +
      `${gargalo.perdaAnterior} profissional(is) ficaram pelo caminho nesta transição.`;
  }

  return (
    <section
      className="panel professional-activation-funnel"
      aria-labelledby="professional-activation-title"
    >
      <div className="panel-heading professional-activation-heading">
        <div>
          <p className="eyebrow">Funil executivo</p>
          <h2 id="professional-activation-title">
            Marcos alcançados no período
          </h2>
          <p className="muted">
            Leitura operacional da ativação: cadastro, criação do negócio,
            primeiro serviço, publicação e confirmação da agenda. Os marcos
            continuam sendo medidos de forma independente; uma transição só
            recebe taxa etapa a etapa quando os números permitem essa comparação.
          </p>
        </div>

        <aside
          className={`professional-activation-priority${gargalo ? " is-attention" : ""}`}
          aria-label="Prioridade atual do funil"
        >
          <span>Prioridade atual</span>
          <strong>
            {prioridade
              ? prioridade.label
              : cadastros
                ? "Sem gargalo dominante"
                : "Aguardando base"}
          </strong>
          <small>
            {prioridade
              ? prioridade.action
              : cadastros
                ? "continue acompanhando a passagem entre os marcos"
                : "gere uma coorte antes de concluir sobre ativação"}
          </small>
        </aside>
      </div>

      <p
        className="professional-activation-diagnosis"
        role="status"
      >
        {diagnostico}
      </p>

      <ol
        className="professional-activation-steps"
        aria-label="Progressão dos marcos de ativação"
      >
        {etapas.map((etapa, index) => {
          const gargaloAtual = gargalo?.key === etapa.key;
          const anterior = etapas[index - 1];

          return (
            <li
              className={`professional-activation-step${gargaloAtual ? " is-bottleneck" : ""}`}
              data-stage={etapa.key}
              key={etapa.key}
            >
              <div className="professional-activation-step-topline">
                <span>{index + 1}</span>
                {gargaloAtual && <strong>Maior perda</strong>}
              </div>

              <h3>{etapa.cardLabel}</h3>
              <p className="professional-activation-value">
                {etapa.quantidade}
                <small> profissionais</small>
              </p>
              <p className="muted">
                {etapa.acumulada}% dos cadastros
              </p>

              {index > 0 && (
                <div className="professional-activation-transition">
                  {etapa.comparavel ? (
                    <>
                      <strong>
                        {etapa.conversaoAnterior}% da etapa anterior
                      </strong>
                      <small>
                        {etapa.perdaAnterior} não chegaram aqui desde “{anterior.label}”
                      </small>
                    </>
                  ) : etapa.motivoComparacao === "sem_base" ? (
                    <>
                      <strong>Sem base anterior</strong>
                      <small>
                        “{anterior.label}” ainda não tem profissionais suficientes para calcular a passagem
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>Marco independente</strong>
                      <small>
                        a quantidade subiu em relação a “{anterior.label}”; não exibimos uma conversão enganosa
                      </small>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <details className="professional-activation-details">
        <summary>Detalhamento do funil</summary>
        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Etapa de ativação</th>
                <th>Profissionais</th>
                <th>% dos cadastros</th>
                <th>Conversão da etapa anterior</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa, index) => (
                <tr key={etapa.key}>
                  <td>{etapa.label}</td>
                  <td>{etapa.quantidade}</td>
                  <td>{etapa.acumulada}%</td>
                  <td>
                    {index === 0
                      ? `${etapa.conversaoAnterior}%`
                      : etapa.comparavel
                        ? `${etapa.conversaoAnterior}%`
                        : "Não comparável"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
