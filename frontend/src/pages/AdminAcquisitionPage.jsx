import { EmptyState } from "../components/ScreenState";
import { CHANNEL_LABELS } from "../features/admin-analytics/labels";
import { number, formatNumber, formatCentavos, formatPercent, formatSeconds } from "../features/admin-analytics/format";
import { MetricCard, AdminSectionFrame } from "../features/admin-analytics/components";
import { useAdminSection } from "../features/admin-analytics/useAdminSection";

export function AdminAcquisitionV2Page() {
  const state = useAdminSection("acquisition");

  return (
    <AdminSectionFrame
      className="admin-acquisition-page"
      description="Origem das sessões e qualidade dos profissionais adquiridos, separando tráfego de ativação e receita."
      eyebrow="Crescimento"
      state={state}
      title="Aquisição"
    >
      {(data) => {
        const origins = Array.isArray(data.sessoesPorOrigem) ? data.sessoesPorOrigem : [];
        const campaigns = Array.isArray(data.funilPorCampanha) ? data.funilPorCampanha : [];
        const acquisitionReturn = data.retornoAquisicao || {};
        const financialCampaigns = Array.isArray(acquisitionReturn.campanhas)
          ? acquisitionReturn.campanhas
          : [];
        const financialDiagnosis = acquisitionReturn.diagnostico || {};
        const contributionReadiness =
          acquisitionReturn.contribuicaoProntidao || {};
        const hasProfessionalCohort = campaigns.length > 0;
        const trafficTotals = origins.reduce((acc, origin) => ({
          sessoes: acc.sessoes + number(origin.sessoes),
          tempoEngajadoMs: acc.tempoEngajadoMs + number(origin.tempo_engajado_ms)
        }), { sessoes: 0, tempoEngajadoMs: 0 });
        const maxOriginSessions = Math.max(
          1,
          ...origins.map((origin) => number(origin.sessoes))
        );
        const identifiedSessions = origins.reduce(
          (total, origin) => total + (
            ["direct", "unknown"].includes(origin.canal)
              ? 0
              : number(origin.sessoes)
          ),
          0
        );
        const identifiedShare = trafficTotals.sessoes > 0
          ? (identifiedSessions / trafficTotals.sessoes) * 100
          : null;
        const hasFinancialDiagnosis = financialCampaigns.length > 0 ||
          Object.values(financialDiagnosis).some((value) => number(value) > 0);
        const totals = campaigns.reduce((acc, campaign) => ({
          cadastros: acc.cadastros + number(campaign.cadastros),
          primeiros: acc.primeiros + number(campaign.primeirosAgendamentos),
          pagas: acc.pagas + number(campaign.assinaturasAtivadas),
          investimento: acc.investimento + number(campaign.investimentoCentavos),
          receita: acc.receita + number(campaign.receitaPrimeiroPagamentoCentavos)
        }), { cadastros: 0, primeiros: 0, pagas: 0, investimento: 0, receita: 0 });

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Cadastros profissionais" hint="profissionais agrupados por origem" value={hasProfessionalCohort ? formatNumber(totals.cadastros) : "—"} />
              <MetricCard label="1º agendamento" hint="agendamentos da coorte profissional" value={hasProfessionalCohort ? formatNumber(totals.primeiros) : "—"} />
              <MetricCard label="Assinaturas pagas" hint="primeiro pagamento válido" value={hasProfessionalCohort ? formatNumber(totals.pagas) : "—"} />
              <MetricCard label="Investimento registrado" hint="custo das campanhas na coorte" value={hasProfessionalCohort ? formatCentavos(totals.investimento) : "—"} />
            </section>

            {!hasProfessionalCohort && (
              <p className="admin-acquisition-scope muted" role="status">
                {origins.length > 0
                  ? "Há sessões registradas, mas o funil não retornou cadastros profissionais neste período. Os indicadores acima não têm coorte para comparação."
                  : "Ainda não há sessões ou cadastros profissionais no funil deste período. Os indicadores acima não têm coorte para comparação."}
              </p>
            )}

            {!data.qualidadeMensuracao?.prontaParaDecisao && data.qualidadeMensuracao?.bloqueios?.length > 0 && (
              <section className="panel admin-command-alert is-warning" role="status">
                <p className="eyebrow">Mensuração incompleta</p>
                <h2>Não use este recorte para escalar orçamento ainda</h2>
                {data.qualidadeMensuracao.bloqueios.map((block) => (
                  <p className="muted" key={block.codigo}>{block.mensagem}</p>
                ))}
              </section>
            )}

            <section className="panel admin-traffic-panel">
              <div className="panel-heading admin-traffic-heading">
                <div>
                  <p className="eyebrow">Tráfego do site</p>
                  <h2>Sessões por origem</h2>
                  <p className="muted">Compare volume, alcance e engajamento sem confundir visita com cadastro. Variações de domínio da mesma rede continuam separadas para preservar a evidência capturada.</p>
                </div>
              </div>
              {origins.length > 0 && (
                <section className="admin-traffic-summary" aria-label="Resumo do tráfego">
                  <MetricCard label="Sessões" hint="visitas registradas no período" value={formatNumber(trafficTotals.sessoes)} />
                  <MetricCard label="Origem identificada" hint="sessões fora de direto/não identificado" value={formatPercent(identifiedShare)} />
                  <MetricCard label="Tempo médio" hint="engajamento médio por sessão" value={trafficTotals.sessoes > 0 ? formatSeconds(trafficTotals.tempoEngajadoMs / trafficTotals.sessoes / 1000) : "—"} />
                </section>
              )}
              {origins.length === 0 ? (
                <EmptyState title="Ainda não há sessões registradas neste período">
                  Não há dados de visitas para mostrar no recorte selecionado.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Canal</th><th>Origem / mídia</th><th>Campanha</th><th>Sessões</th><th>Tempo médio</th></tr></thead>
                    <tbody>
                      {origins.map((row, index) => (
                        <tr key={`${row.canal}-${row.source}-${row.medium}-${row.campanha_oficial_id || index}`}>
                          <td>{CHANNEL_LABELS[row.canal] || row.canal}</td>
                          <td><strong>{row.source}</strong><small> / {row.medium}</small></td>
                          <td>{row.campanha_nome || row.utm_campaign || "—"}</td>
                          <td>
                            <div className="admin-traffic-volume">
                              <strong>{formatNumber(row.sessoes)}</strong>
                              <span aria-hidden="true"><i style={{ width: `${Math.max(4, (number(row.sessoes) / maxOriginSessions) * 100)}%` }} /></span>
                            </div>
                          </td>
                          <td>{number(row.sessoes) > 0 ? formatSeconds(number(row.tempo_engajado_ms) / number(row.sessoes) / 1000) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Qualidade por origem</p>
                  <h2>Do cadastro à receita</h2>
                </div>
              </div>
              {campaigns.length === 0 ? (
                <EmptyState title="Nenhuma coorte profissional neste período">
                  O funil não retornou cadastros profissionais neste recorte. Sessões registradas não são contadas como cadastros.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Campanha / origem</th><th>Cadastros</th><th>Publicados</th><th>1º agendamento</th><th>Pagas</th><th>CAC</th><th>ROAS</th></tr></thead>
                    <tbody>
                      {campaigns.map((campaign, index) => (
                        <tr key={`${campaign.origem}-${campaign.midia}-${campaign.campanha}-${index}`}>
                          <td><strong>{campaign.campanha || "Sem campanha"}</strong><small>{campaign.origem} / {campaign.midia}</small></td>
                          <td>{formatNumber(campaign.cadastros)}</td>
                          <td>{formatNumber(campaign.negociosPublicados)}</td>
                          <td>{formatNumber(campaign.primeirosAgendamentos)}</td>
                          <td>{formatNumber(campaign.assinaturasAtivadas)}</td>
                          <td>{formatCentavos(campaign.cacAssinanteCentavos)}</td>
                          <td>{campaign.roas === null || campaign.roas === undefined ? "—" : `${number(campaign.roas).toFixed(2)}x`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Resultados financeiros</p>
                  <h2>Retorno da aquisição paga</h2>
                  <p className="muted">
                    Investimento e receita consideram os mesmos negócios elegíveis. Esta leitura é acumulada desde o início da cobertura financeira e não muda com o período selecionado acima.
                  </p>
                </div>
              </div>

              {hasFinancialDiagnosis && <section className="admin-command-summary-grid is-period-summary">
                <MetricCard
                  label="Pagantes com campanha atribuída"
                  hint="negócios pagos com campanha de aquisição confirmada"
                  value={financialDiagnosis.snapshotsOficiais == null ? "—" : formatNumber(financialDiagnosis.snapshotsOficiais)}
                />
                <MetricCard
                  label="Reconciliação pendente"
                  hint="conversões aguardando confirmação financeira"
                  tone={number(financialDiagnosis.snapshotsPendentes) > 0 ? "warning" : "neutral"}
                  value={financialDiagnosis.snapshotsPendentes == null ? "—" : formatNumber(financialDiagnosis.snapshotsPendentes)}
                />
                <MetricCard
                  label="Atribuição incompleta"
                  hint="negócios pagos sem campanha confirmada"
                  tone={number(financialDiagnosis.snapshotsAtribuicaoIncompleta) > 0 ? "warning" : "neutral"}
                  value={financialDiagnosis.snapshotsAtribuicaoIncompleta == null ? "—" : formatNumber(financialDiagnosis.snapshotsAtribuicaoIncompleta)}
                />
                <MetricCard
                  label="Pagantes sem custo D30"
                  hint="negócios sem custo de campanha registrado na data de aquisição"
                  tone={number(financialDiagnosis.pagantesSemCustoD30) > 0 ? "warning" : "neutral"}
                  value={financialDiagnosis.pagantesSemCustoD30 == null ? "—" : formatNumber(financialDiagnosis.pagantesSemCustoD30)}
                />
              </section>}

              {(number(financialDiagnosis.snapshotsPendentes) > 0 ||
                number(financialDiagnosis.pagantesSemCustoD30) > 0) && (
                <div className="admin-command-alert is-warning" role="status">
                  <strong>Leitura financeira ainda possui pendências.</strong>
                  <p className="muted">
                    O AF não transforma reconciliação pendente ou cobertura de custo incompleta em CAC/retorno aparentemente preciso.
                  </p>
                </div>
              )}

              {hasFinancialDiagnosis && !contributionReadiness.retornoContribuicaoDisponivel && (
                <div className="admin-command-alert is-warning" role="status">
                  <strong>Retorno de contribuição ainda indisponível.</strong>
                  <p className="muted">
                    Para calcular o retorno, é necessário ter investimento de mídia, pagamentos confirmados e custos variáveis completos para os mesmos negócios.
                  </p>
                </div>
              )}

              {financialCampaigns.length === 0 ? (
                <EmptyState title="Sem dados suficientes para calcular o retorno">
                  Nenhuma campanha atende aos critérios financeiros para esta leitura acumulada no momento.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Campanha</th>
                        <th>Investimento D30</th>
                        <th>CAC mídia D30</th>
                        <th>Retorno D30</th>
                        <th>Retorno D60</th>
                        <th>Retorno D90</th>
                        <th>Recuperação bruta</th>
                        <th>Recuperação líquida</th>
                        <th>Recuperação contribuição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialCampaigns.map((campaign) => {
                        const windows = Array.isArray(campaign.janelas)
                          ? campaign.janelas
                          : [];
                        const d30 = windows.find((item) => number(item.dias) === 30);
                        const d60 = windows.find((item) => number(item.dias) === 60);
                        const d90 = windows.find((item) => number(item.dias) === 90);
                        const renderReturn = (window) => {
                          const bruto = window?.leitura?.comparavel
                            ? (
                              window.retornoBruto == null
                                ? "—"
                                : `${number(window.retornoBruto).toFixed(2)}x`
                            )
                            : window?.leitura?.rotulo || "Aguardando";
                          const liquido = window?.economiaLiquida?.comparavel
                            ? (
                              window.retornoLiquidoGateway == null
                                ? "—"
                                : `${number(window.retornoLiquidoGateway).toFixed(2)}x`
                            )
                            : "Aguardando economia";
                          const contribuicao = window?.contribuicao?.comparavel
                            ? (
                              window.contribuicao.retornoContribuicao == null
                                ? "—"
                                : `${number(window.contribuicao.retornoContribuicao).toFixed(2)}x`
                            )
                            : window?.contribuicao?.rotulo || "Aguardando contribuição";

                          return (
                            <>
                              {bruto}
                              <small>Líquido gateway {liquido}</small>
                              <small>Contribuição {contribuicao}</small>
                            </>
                          );
                        };

                        return (
                          <tr key={campaign.campanhaOficialId}>
                            <td>
                              <strong>{campaign.campanha || "Campanha sem nome"}</strong>
                              <small>{campaign.origem || campaign.canal || "—"} / {campaign.midia || "—"}</small>
                            </td>
                            <td>{formatCentavos(d30?.investimentoCentavos)}</td>
                            <td>
                              {d30?.leitura?.comparavel
                                ? formatCentavos(d30.cacMidiaCentavos)
                                : d30?.leitura?.rotulo || "Aguardando"}
                              {d30?.ltvBrutoSobreCacMidia != null && (
                                <small>LTV bruto/CAC mídia {number(d30.ltvBrutoSobreCacMidia).toFixed(2)}x</small>
                              )}
                            </td>
                            <td>{renderReturn(d30)}</td>
                            <td>{renderReturn(d60)}</td>
                            <td>{renderReturn(d90)}</td>
                            <td>
                              {campaign.primeiraRecuperacaoReceitaBrutaDias
                                ? `até D${campaign.primeiraRecuperacaoReceitaBrutaDias}`
                                : "Não observada"}
                            </td>
                            <td>
                              {campaign.primeiraRecuperacaoLiquidaGatewayDias
                                ? `até D${campaign.primeiraRecuperacaoLiquidaGatewayDias}`
                                : "Não observada"}
                            </td>
                            <td>
                              {campaign.primeiraRecuperacaoContribuicaoDias
                                ? `até D${campaign.primeiraRecuperacaoContribuicaoDias}`
                                : "Não observada"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {financialCampaigns.length > 0 && <p className="muted">
                O custo por aquisição mostrado considera investimento em mídia. Custos fixos e lucro não entram neste cálculo.
              </p>}
            </section>

            <details className="admin-metric-definition">
              <summary>Como interpretar aquisição</summary>
              <p>Sessões são visitas ao site e não representam cadastros, agendamentos ou pagamentos. A origem depende das informações disponíveis e do consentimento para medição de marketing.</p>
              <p>Os indicadores do funil agrupam profissionais conforme a evidência de origem disponível, inclusive quando a origem não pôde ser identificada. Visitas sem cadastro não entram nessa coorte.</p>
              <p>O retorno da mídia usa investimento e pagamentos dos mesmos negócios elegíveis ao longo do tempo, independentemente do filtro do topo. Valores sem cobertura suficiente não são estimados; custos fixos e lucro ficam fora da análise.</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}
