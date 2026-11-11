import { number, formatNumber, formatCurrency, formatPercent } from "../features/admin-analytics/format";
import { MetricCard, AdminSectionFrame } from "../features/admin-analytics/components";
import { useAdminSection } from "../features/admin-analytics/useAdminSection";

export function AdminOverviewV2Page() {
  const state = useAdminSection("overview");

  return (
    <AdminSectionFrame
      className="admin-overview-page"
      description="Aquisição, primeiro agendamento e receita no período selecionado."
      eyebrow="Resultados"
      state={state}
      title="Visão geral"
    >
      {(data) => {
        const audience = data.audiencia || {};
        const acquisition = data.aquisicao || {};
        const activation = data.ativacao || {};
        const demand = data.demanda || {};
        const revenue = data.receita || {};
        const hasProfessionalCohort = number(acquisition.cadastrosProfissionais) > 0;

        const activationSteps = [
          ["Cadastros profissionais", acquisition.cadastrosProfissionais],
          ["Negócios criados", activation.negociosCriados],
          ["Negócios com 1º serviço criado", activation.servicosCriados],
          ["Negócios publicados", activation.negociosPublicados],
          ["1º agendamento válido", activation.primeirosAgendamentos],
          ["Assinaturas pagas", revenue.assinaturasAtivadasCohorte]
        ];

        return (
          <>
            <section aria-label="Indicadores do período" className="admin-command-summary-grid is-period-summary">
              <MetricCard
                hint="Com login nas visitas do período"
                label="Contas que acessaram"
                value={formatNumber(audience.usuariosAtivos)}
              />
              <MetricCard
                hint="Profissionais cadastrados no período"
                label="Cadastros profissionais"
                value={formatNumber(acquisition.cadastrosProfissionais)}
              />
              <MetricCard
                hint={hasProfessionalCohort
                  ? `${formatPercent(activation.taxaPrimeiroAgendamentoSobreCadastro)} dos cadastros da coorte`
                  : "Sem cadastros para calcular a taxa"}
                label="1º agendamento"
                tone={number(activation.primeirosAgendamentos) > 0 ? "success" : "neutral"}
                value={formatNumber(activation.primeirosAgendamentos)}
              />
              <MetricCard
                hint="Pagamentos recebidos de planos pagos"
                label="Receita confirmada"
                tone={number(revenue.receitaConfirmada) > 0 ? "success" : "neutral"}
                value={formatCurrency(revenue.receitaConfirmada)}
              />
            </section>

            <section className="panel admin-command-funnel-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Ativação e monetização</p>
                  <h2>Coorte profissional: do cadastro à assinatura</h2>
                  <p className="muted">
                    Marcos dos profissionais cadastrados no período. A receita acima reúne pagamentos recebidos no período, fora desta coorte.
                  </p>
                </div>
              </div>
              {hasProfessionalCohort ? (
                <>
                  <div className="admin-command-funnel is-milestones">
                    {activationSteps.map(([label, value]) => (
                      <article key={label}>
                        <small>{label}</small>
                        <strong>{formatNumber(value)}</strong>
                      </article>
                    ))}
                  </div>
                  <dl className="admin-command-data-list">
                    <div>
                      <dt>Cadastro → negócio</dt>
                      <dd>{formatPercent(activation.taxaNegocioSobreCadastro)}</dd>
                    </div>
                    <div>
                      <dt>Cadastro → serviço</dt>
                      <dd>{formatPercent(activation.taxaServicoSobreCadastro)}</dd>
                    </div>
                    <div>
                      <dt>Cadastro → publicação</dt>
                      <dd>{formatPercent(activation.taxaPublicacaoSobreCadastro)}</dd>
                    </div>
                    <div>
                      <dt>Cadastro → 1º agendamento</dt>
                      <dd>{formatPercent(activation.taxaPrimeiroAgendamentoSobreCadastro)}</dd>
                    </div>
                    <div>
                      <dt>Cadastro → assinatura paga</dt>
                      <dd>{formatPercent(revenue.taxaAssinaturaSobreCadastro)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="admin-overview-empty">
                  <strong>Nenhum cadastro profissional neste período</strong>
                  <p>Sem cadastros, não há taxas da coorte para calcular. Agendamentos e pagamentos do período aparecem abaixo.</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Demanda e receita</p>
                  <h2>Fatos ocorridos no período</h2>
                </div>
              </div>
              <dl className="admin-command-data-list">
                <div><dt>Agendamentos válidos</dt><dd>{formatNumber(demand.agendamentosValidos)}</dd></div>
                <div><dt>Pagamentos confirmados</dt><dd>{formatNumber(revenue.pagamentosConfirmados)}</dd></div>
                <div><dt>Negócios com pagamento no período</dt><dd>{formatNumber(revenue.negociosComPagamento)}</dd></div>
              </dl>
            </section>

            <details className="admin-metric-definition">
              <summary>Fontes e critérios desta visão</summary>
              <p>{data.metodologia?.audiencia}</p>
              <p>{data.metodologia?.ativacao}</p>
              <p>{data.metodologia?.receita}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}
