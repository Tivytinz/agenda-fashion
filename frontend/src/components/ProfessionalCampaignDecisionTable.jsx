import { Fragment } from "react";
import {
  campaignKey,
  campaignLabel,
  campaignMediumLabel,
  campaignSourceMeta,
  decisionBadgeClass,
  decisionSignalLabel,
  formatCampaignMoney,
  formatCampaignRoas,
  isOrganicCampaign,
  utmIdentityLabel
} from "../utils/professionalCampaigns";

export function ProfessionalCampaignDecisionTable({
  campaigns,
  decision,
  expandedCampaign,
  measurementReady,
  onToggle
}) {
  if (campaigns.length === 0) {
    return (
      <p className="muted">
        Ainda não há campanhas com atribuição oficial nesta coorte.
      </p>
    );
  }

  return (
    <div className="table-wrap admin-chart-table-spacing">
      <table className="admin-decision-table">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Investimento</th>
            <th>Receita</th>
            <th>ROAS</th>
            <th>CAC</th>
            <th>Decisão</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((item) => {
            const key = campaignKey(item);
            const expanded = expandedCampaign === key;
            const source = campaignSourceMeta(item);
            const medium = campaignMediumLabel(item);
            const identities = Array.isArray(item.identidadesUtm)
              ? item.identidadesUtm
              : [];

            return (
              <Fragment key={key}>
                <tr>
                  <td>
                    <strong>{campaignLabel(item)}</strong>
                    <div className="admin-campaign-source">
                      <span className={`admin-status-badge admin-source-badge is-${source.code}`}>
                        {source.label}
                      </span>
                      {medium && <small className="admin-medium-label">{medium}</small>}
                      {identities.length > 1 && (
                        <small className="admin-medium-label">
                          {identities.length} identidades vinculadas
                        </small>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.investimentoCentavos > 0
                      ? formatCampaignMoney(item.investimentoCentavos)
                      : (
                        <span className="admin-data-empty">
                          {isOrganicCampaign(item) ? "Não se aplica" : "Não atribuído"}
                        </span>
                      )}
                  </td>
                  <td>
                    {formatCampaignMoney(item.receitaPrimeiroPagamentoCentavos ?? 0)}
                    {!measurementReady && (
                      <small className="admin-data-empty">Parcial</small>
                    )}
                  </td>
                  <td>
                    <strong className={!measurementReady || item.roas === null || item.roas === undefined ? "admin-data-empty" : ""}>
                      {!measurementReady
                        ? "Aguardando cobertura"
                        : item.roas === null || item.roas === undefined
                          ? "Não calculável"
                          : formatCampaignRoas(item.roas)}
                    </strong>
                  </td>
                  <td>
                    <span className={!measurementReady || item.cacAssinanteCentavos === null || item.cacAssinanteCentavos === undefined ? "admin-data-empty" : ""}>
                      {!measurementReady
                        ? "Aguardando cobertura"
                        : item.cacAssinanteCentavos === null || item.cacAssinanteCentavos === undefined
                          ? "Não calculável"
                          : formatCampaignMoney(item.cacAssinanteCentavos)}
                    </span>
                  </td>
                  <td className="admin-decision-cell">
                    <span className={decisionBadgeClass(item.decisao?.codigo)}>
                      {item.decisao?.rotulo || "Sem dados"}
                    </span>
                    {item.decisao?.codigo !== "sem_dados" && (
                      <small className="muted">
                        {decisionSignalLabel(item.decisao?.confianca)}
                      </small>
                    )}
                  </td>
                  <td>
                    <button
                      aria-expanded={expanded}
                      className="button button-secondary button-small admin-detail-toggle"
                      onClick={() => onToggle(expanded ? "" : key)}
                      type="button"
                    >
                      {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  </td>
                </tr>

                {expanded && (
                  <tr className="admin-campaign-detail-row">
                    <td colSpan="7">
                      <div className="admin-campaign-detail-grid">
                        <div><span>Cadastros</span><strong>{item.cadastros}</strong></div>
                        <div><span>Checkouts</span><strong>{item.checkoutsIniciados}</strong></div>
                        <div>
                          <span>Primeiros agendamentos</span>
                          <strong>{item.primeirosAgendamentos ?? 0} · {item.taxaPrimeiroAgendamento ?? 0}%</strong>
                        </div>
                        <div>
                          <span>Assinaturas</span>
                          <strong>{item.assinaturasAtivadas} · {item.taxaAssinatura}%</strong>
                        </div>
                        <div>
                          <span>Custo por cadastro</span>
                          <strong>{measurementReady ? formatCampaignMoney(item.custoCadastroCentavos) : "Aguardando cobertura"}</strong>
                        </div>
                        <div>
                          <span>Custo por checkout</span>
                          <strong>{measurementReady ? formatCampaignMoney(item.custoCheckoutCentavos) : "Aguardando cobertura"}</strong>
                        </div>
                        <div>
                          <span>Cadastros maduros</span>
                          <strong>{item.cadastrosMadurosAtivacao ?? 0} ativação · {item.cadastrosMadurosMonetizacao ?? 0} monetização</strong>
                        </div>
                        <div>
                          <span>Ativação na janela</span>
                          <strong>
                            {item.negociosPublicadosMadurosAtivacao ?? 0} publicados · {item.primeirosAgendamentosMadurosAtivacao ?? 0} com primeiro agendamento em até {decision.diasMaturacaoAtivacao ?? 14} dias
                          </strong>
                        </div>
                        <div>
                          <span>Monetização na janela</span>
                          <strong>{item.assinaturasAtivadasMadurasMonetizacao ?? 0} assinaturas em até {decision.diasMaturacaoMonetizacao ?? 21} dias</strong>
                        </div>
                        {identities.length > 1 && (
                          <div className="admin-campaign-decision-reason">
                            <span>Identidades UTM incluídas</span>
                            <strong>{identities.map(utmIdentityLabel).join(" · ")}</strong>
                          </div>
                        )}
                        {item.decisao?.motivo && (
                          <div className="admin-campaign-decision-reason">
                            <span>Motivo da recomendação</span>
                            <strong>{item.decisao.motivo}</strong>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
