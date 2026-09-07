import { formatMetricPercent } from "../utils/marketingMetrics";
import {
  campaignConversionsWithCost,
  campaignCostCoverage,
  campaignSessionsWithCost,
  channelLabel,
  formatMarketingMoney,
  objectiveLabel
} from "../utils/marketingCosts";

export function MarketingCampaignCostTable({ campaigns }) {
  return (
    <div className="table-wrap">
      <table className="admin-performance-table">
        <caption className="sr-only">Desempenho financeiro por campanha</caption>
        <thead>
          <tr>
            <th>Campanha</th>
            <th className="admin-numeric-cell">Investimento</th>
            <th className="admin-numeric-cell">Sessões atribuídas</th>
            <th className="admin-numeric-cell">Cobertura financeira</th>
            <th className="admin-numeric-cell">CPS</th>
            <th className="admin-numeric-cell">Conversões</th>
            <th className="admin-numeric-cell">CPA</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((item) => (
            <tr key={item.campanhaId}>
              <td>
                <strong>{item.nome}</strong>
                <small className="admin-table-secondary">
                  {channelLabel(item.canal)} · {objectiveLabel(item.objetivo)}
                  {item.ativo === false ? " · Arquivada" : ""}
                </small>
              </td>
              <td className="admin-numeric-cell">{formatMarketingMoney(item.investimentoCentavos)}</td>
              <td className="admin-numeric-cell">
                <strong>{item.sessoes}</strong>
                <small className="admin-table-secondary">
                  {Number(item.sessoesAtribuicaoAssistida || 0) > 0
                    ? `${Number(item.sessoesAtribuicaoAssistida)} assistidas`
                    : "atribuição direta"}
                </small>
              </td>
              <td className="admin-numeric-cell">
                <strong>{formatMetricPercent(campaignCostCoverage(item))}</strong>
                <small className="admin-table-secondary">
                  {campaignSessionsWithCost(item)} de {item.sessoes}
                </small>
              </td>
              <td className="admin-numeric-cell">{formatMarketingMoney(item.custoPorSessaoCentavos)}</td>
              <td className="admin-numeric-cell">
                {item.objetivo === "cliente" ? (
                  <>
                    {item.agendamentosConcluidos}
                    <small className="admin-table-secondary">
                      {campaignConversionsWithCost(item)} com custo
                    </small>
                  </>
                ) : (
                  <span className="admin-data-empty">CAC em Aquisição e retorno</span>
                )}
              </td>
              <td className="admin-numeric-cell">
                {item.objetivo === "cliente"
                  ? formatMarketingMoney(item.cpaCentavos)
                  : <span className="admin-data-empty">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
