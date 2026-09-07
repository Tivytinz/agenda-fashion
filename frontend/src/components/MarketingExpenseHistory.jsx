import {
  channelLabel,
  costSourceLabel,
  formatMarketingDate,
  formatMarketingMoney,
  objectiveLabel
} from "../utils/marketingCosts";

export function MarketingExpenseHistory({ expenses }) {
  if (expenses.length === 0) {
    return <p className="muted">Nenhum investimento registrado neste período.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Campanha</th>
            <th>Objetivo</th>
            <th>Canal</th>
            <th>Fonte</th>
            <th>Valor</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((item) => (
            <tr key={item.id}>
              <td>{formatMarketingDate(item.dataGasto)}</td>
              <td>{item.campanhaNome || "Campanha indisponível"}</td>
              <td>{objectiveLabel(item.objetivo)}</td>
              <td>{channelLabel(item.canal)}</td>
              <td>{costSourceLabel(item.fonte)}</td>
              <td>{formatMarketingMoney(item.valorCentavos)}</td>
              <td>{item.observacao || "Sem observação"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
