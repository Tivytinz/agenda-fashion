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

function taxaInformada(valor, parte, total) {
  if (
    valor !== null &&
    valor !== undefined &&
    Number.isFinite(Number(valor))
  ) {
    return Number(valor);
  }

  return percentual(parte, total);
}

export function ProfessionalPostAgendaFunnel({
  summary = {}
}) {
  const agendas = numero(
    summary.agendasConfiguradas
  );
  const divulgados = numero(
    summary.perfisDivulgados
  );
  const visitas = numero(
    summary.visitasPosDivulgacao
  );
  const iniciados = numero(
    summary.agendamentosIniciadosPosDivulgacao
  );
  const confirmados = numero(
    summary.primeirosAgendamentosJornada ??
    summary.primeirosAgendamentosViaDivulgacao
  );

  const etapas = [
    {
      label: "Agendas configuradas",
      quantidade: agendas,
      acumulada: agendas ? 100 : 0,
      conversao: agendas ? 100 : 0
    },
    {
      label: "Perfil divulgado",
      quantidade: divulgados,
      acumulada: percentual(divulgados, agendas),
      conversao: taxaInformada(
        summary.taxaDivulgacaoPosAgenda,
        divulgados,
        agendas
      )
    },
    {
      label: "Visita após divulgação",
      quantidade: visitas,
      acumulada: percentual(visitas, agendas),
      conversao: taxaInformada(
        summary.taxaVisitaPosDivulgacao,
        visitas,
        divulgados
      )
    },
    {
      label: "Agendamento iniciado",
      quantidade: iniciados,
      acumulada: percentual(iniciados, agendas),
      conversao: taxaInformada(
        summary.taxaInicioPosVisita,
        iniciados,
        visitas
      )
    },
    {
      label: "Primeiro agendamento da jornada",
      quantidade: confirmados,
      acumulada: percentual(confirmados, agendas),
      conversao: taxaInformada(
        summary.taxaConclusaoPosInicio,
        confirmados,
        iniciados
      )
    }
  ];

  let diagnostico =
    "A jornada completa já aparece na coorte. Compare as conversões entre etapas para localizar a maior perda.";

  if (agendas === 0) {
    diagnostico =
      "A coorte ainda não tem agendas configuradas para avaliar divulgação.";
  } else if (divulgados === 0) {
    diagnostico =
      "O primeiro gargalo está na divulgação: há agendas prontas, mas nenhum link do negócio foi compartilhado pelo dono após a configuração.";
  } else if (visitas === 0) {
    diagnostico =
      "Houve divulgação, mas nenhuma outra sessão visualizou o perfil depois dela.";
  } else if (iniciados === 0) {
    diagnostico =
      "O perfil recebeu visita após divulgação, mas nenhuma dessas sessões avançou até iniciar o agendamento.";
  } else if (confirmados === 0) {
    diagnostico =
      "Há sessões iniciando o agendamento, mas nenhuma conclusão rastreada aponta para o primeiro agendamento real do mesmo negócio.";
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Pós-agenda</p>
          <h2>Da divulgação ao agendamento</h2>
          <p className="muted">
            Sequência estrita: o dono divulga o perfil depois de configurar a agenda, outra sessão visita o negócio, uma sessão visitante inicia o agendamento e a conclusão precisa apontar para o primeiro agendamento real do mesmo negócio.
          </p>
          <p className="muted">{diagnostico}</p>
        </div>
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Conversão pós-agenda</strong>
          <small>
            A primeira porcentagem usa as agendas configuradas como base. A segunda mede a passagem da etapa imediatamente anterior.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Profissionais</th>
                <th>% das agendas</th>
                <th>Conversão da etapa anterior</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => (
                <tr key={etapa.label}>
                  <td>{etapa.label}</td>
                  <td>{etapa.quantidade}</td>
                  <td>{etapa.acumulada}%</td>
                  <td>{etapa.conversao}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted admin-campaign-attribution-note">
        “Após divulgação” descreve ordem temporal, não prova que a visita veio do link compartilhado. Eventos de intenção não contam como agendamento. Se um evento de produto não chegar, a jornada rastreada pode ficar abaixo do total real de primeiros agendamentos.
      </p>
    </section>
  );
}
