import { EmptyState } from "../components/ScreenState";
import { ACQUISITION_CLASSIFICATION_LABELS } from "../features/admin-analytics/labels";
import { number, formatNumber, formatCentavos, formatPercent } from "../features/admin-analytics/format";
import { MetricCard, AdminSectionFrame } from "../features/admin-analytics/components";
import { useAdminSection } from "../features/admin-analytics/useAdminSection";

export function AdminRetentionV2Page() {
  const state = useAdminSection("retention");

  return (
    <AdminSectionFrame
      description="Se os profissionais continuam gerando agendamentos depois do primeiro valor entregue."
      eyebrow="Retenção"
      state={state}
      title="Retenção"
    >
      {(data) => {
        const summary = data.resumo || {};
        const timing = data.tempos?.primeiroParaSegundo || {};
        const windows = Array.isArray(data.janelasCandidatas) ? data.janelasCandidatas : [];
        const cohorts = Array.isArray(data.coortesSemanais) ? data.coortesSemanais : [];
        const acquisitionQuality = Array.isArray(data.qualidadeAquisicao)
          ? data.qualidadeAquisicao
          : [];
        const campaignQuality = Array.isArray(data.qualidadeCampanhasOficiais)
          ? data.qualidadeCampanhasOficiais
          : [];
        const costDiagnosis = data.diagnosticoCustoAquisicao || {};

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Com 1º agendamento" hint="profissionais que chegaram ao primeiro valor" value={formatNumber(summary.comPrimeiroAgendamento)} />
              <MetricCard label="Com 2º agendamento" hint={formatPercent(summary.taxaSegundoSobrePrimeiro) + " sobre o primeiro"} value={formatNumber(summary.comSegundoAgendamento)} />
              <MetricCard label="Com 3º agendamento" hint={formatPercent(summary.taxaTerceiroSobrePrimeiro) + " sobre o primeiro"} value={formatNumber(summary.comTerceiroAgendamento)} />
              <MetricCard label="Mediana até o 2º" hint={`${formatNumber(timing.amostra)} profissionais na amostra`} value={timing.medianaDias === null || timing.medianaDias === undefined ? "—" : `${timing.medianaDias} dias`} />
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Maturidade</p><h2>Recorrência nas janelas candidatas</h2></div></div>
              {windows.length === 0 ? <p className="muted">Amostra insuficiente.</p> : (
                <div className="admin-command-funnel is-milestones admin-retention-windows">
                  {windows.map((window) => (
                    <article key={window.janelaDias}>
                      <small>D{window.janelaDias}</small>
                      <strong>{formatPercent(window.taxaSegundoNaJanela)}</strong>
                      <span>
                        {number(window.elegiveis) > 0
                          ? `${formatNumber(window.comSegundoNaJanela)} de ${formatNumber(window.elegiveis)} maduros chegaram ao 2º`
                          : "Sem base madura nesta janela"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Coortes</p><h2>Cadastro por semana</h2></div></div>
              {cohorts.length === 0 ? (
                <EmptyState title="Sem coortes no período">Ainda não existe base suficiente neste recorte.</EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Semana</th><th>Profissionais</th><th>Com 1º agendamento</th><th>Taxa</th></tr></thead>
                    <tbody>
                      {cohorts.map((cohort) => (
                        <tr key={cohort.semanaCadastro}>
                          <td>{cohort.semanaCadastro}</td>
                          <td>{formatNumber(cohort.profissionais)}</td>
                          <td>{formatNumber(cohort.comPrimeiroAgendamento)}</td>
                          <td>{formatPercent(cohort.taxaPrimeiroSobreProfissionais)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {acquisitionQuality.length > 0 && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Qualidade da aquisição</p>
                    <h2>Recorrência por origem</h2>
                    <p className="muted">
                      A origem preserva a classificação de atribuição; recorrência não promove tráfego incompleto para campanha oficial.
                    </p>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Origem</th>
                        <th>Profissionais</th>
                        <th>1º agendamento</th>
                        <th>2º agendamento</th>
                        <th>3º agendamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acquisitionQuality.map((item) => (
                        <tr key={item.chave}>
                          <td>
                            <strong>{item.origem}</strong>
                            <small>
                              {ACQUISITION_CLASSIFICATION_LABELS[item.classificacaoAtribuicao] || item.classificacaoAtribuicao}
                            </small>
                          </td>
                          <td>{formatNumber(item.profissionais)}</td>
                          <td>{formatNumber(item.comPrimeiroAgendamento)}</td>
                          <td>{formatNumber(item.comSegundoAgendamento)}</td>
                          <td>{formatNumber(item.comTerceiroAgendamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {campaignQuality.length > 0 && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Campanhas oficiais</p>
                    <h2>Custo, repetição e prontidão financeira</h2>
                    <p className="muted">
                      Custos são observados sobre a coorte; a prontidão libera leitura descritiva e não uma decisão automática de orçamento.
                    </p>
                  </div>
                </div>
                <div className="admin-command-summary-grid is-period-summary">
                  <MetricCard
                    label="Profissionais oficiais"
                    hint="atribuição oficial na seleção"
                    value={formatNumber(costDiagnosis.profissionaisOficiais)}
                  />
                  <MetricCard
                    label="Cobertura paga"
                    hint={costDiagnosis.medicaoIncompleta ? "mensuração ainda incompleta" : "base paga classificável"}
                    value={formatPercent(costDiagnosis.coberturaAtribuicaoPaga)}
                  />
                  <MetricCard
                    label="Pagos pendentes"
                    hint="sem atribuição oficial"
                    value={formatNumber(costDiagnosis.pagosSemAtribuicaoOficial)}
                  />
                  <MetricCard
                    label="Sem evidência"
                    hint="origem não comprovada"
                    value={formatNumber(costDiagnosis.profissionaisSemEvidencia)}
                  />
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Campanha</th>
                        <th>Profissionais</th>
                        <th>1º agendamento</th>
                        <th>2º agendamento</th>
                        <th>Investimento</th>
                        <th>Custo / 1º</th>
                        <th>D7 financeiro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignQuality.map((campaign) => {
                        const d7 = (
                          Array.isArray(campaign.prontidaoFinanceiraRecorrencia)
                            ? campaign.prontidaoFinanceiraRecorrencia
                            : []
                        ).find((window) => number(window.janelaDias) === 7);

                        return (
                          <tr key={campaign.chave}>
                            <td>
                              <strong>{campaign.campanha || "Campanha sem nome"}</strong>
                              <small>{campaign.origem} / {campaign.midia}</small>
                            </td>
                            <td>{formatNumber(campaign.profissionais)}</td>
                            <td>{formatNumber(campaign.comPrimeiroAgendamento)}</td>
                            <td>{formatNumber(campaign.comSegundoAgendamento)}</td>
                            <td>{formatCentavos(campaign.investimentoCentavos)}</td>
                            <td>{formatCentavos(campaign.custoObservadoPrimeiroAgendamentoCentavos)}</td>
                            <td>{d7?.leitura?.rotulo || "Sem base D7"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <details className="admin-metric-definition">
              <summary>Metodologia</summary>
              <p>{data.metodologia?.criterio}</p>
              <p>{data.metodologia?.janelas}</p>
              <p>{data.metodologia?.observacao}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}
