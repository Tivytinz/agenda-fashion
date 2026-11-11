import { EmptyState } from "../components/ScreenState";
import { AdminContributionOperationsPanel } from "../components/AdminContributionOperationsPanel";
import { AdminContributionSyncPanel } from "../components/AdminContributionSyncPanel";


import { number, formatNumber, formatCurrency, formatPercent, formatDateTime } from "../features/admin-analytics/format";
import { MetricCard, AdminSectionFrame } from "../features/admin-analytics/components";
import { useAdminSection } from "../features/admin-analytics/useAdminSection";

export function AdminRevenueV2Page() {
  const state = useAdminSection("revenue");

  return (
    <AdminSectionFrame
      description="Checkout, primeiro pagamento, renovações e base pagante — cada um com significado financeiro separado."
      eyebrow="Monetização"
      state={state}
      title="Receita"
    >
      {(data) => {
        const summary = data.resumo || {};
        const plans = Array.isArray(data.planos) ? data.planos : [];
        const ltv = data.ltv || {};
        const economics = data.economiaLiquida || {};
        const contribution = data.contribuicao || {};
        const ltvCohorts = Array.isArray(ltv.coortes)
          ? ltv.coortes
          : [];

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Receita bruta" hint="cobranças que tiveram pagamento no período" value={formatCurrency(summary.receitaBruta)} />
              <MetricCard label="Receita atualmente válida" hint="pagamentos hoje confirmados/recebidos" tone={number(summary.receitaValidaAtual) > 0 ? "success" : "neutral"} value={formatCurrency(summary.receitaValidaAtual)} />
              <MetricCard label="Receita inicial" hint="primeiro pagamento válido de cada negócio" value={formatCurrency(summary.receitaPrimeiraConversao)} />
              <MetricCard label="Receita de renovação" hint="pagamentos posteriores da mesma assinatura" tone={number(summary.receitaRenovacao) > 0 ? "success" : "neutral"} value={formatCurrency(summary.receitaRenovacao)} />
              <MetricCard label="Mudança de plano" hint="primeiro pagamento de outra assinatura do mesmo negócio" value={formatCurrency(summary.receitaMudancaPlano)} />
              <MetricCard label="Valor exposto a reversões" hint={`${formatNumber(summary.pagamentosEmReversao)} pagamento(s) em estorno, reversão ou disputa`} tone={number(summary.valorExpostoReversoes) > 0 ? "warning" : "neutral"} value={formatCurrency(summary.valorExpostoReversoes)} />
              <MetricCard label="Assinaturas pagas ativas" hint="estoque atual, não criação no período" value={formatNumber(summary.assinaturasPagasAtivas)} />
            </section>

            <section className="panel admin-revenue-economics-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Economia do gateway</p>
                  <h2>Economia do recebimento</h2>
                  <p className="muted">
                    netValue e refunds concluídos vêm da reconciliação do Asaas. Esta leitura não é lucro nem margem de contribuição.
                  </p>
                </div>
              </div>
              {number(economics.pagamentosIncompletos) > 0 && (
                <div className="admin-command-alert is-warning" role="status">
                  <strong>Reconciliação econômica incompleta.</strong>
                  <p className="muted">
                    Pagamentos sem netValue confiável, em liquidação, refund ou disputa não entram como receita líquida aparentemente precisa.
                  </p>
                </div>
              )}
              {!contribution.margemContribuicaoDisponivel && (
                <div className="admin-command-alert is-warning" role="status">
                  <strong>Margem de contribuição ainda indisponível.</strong>
                  <p className="muted">
                    A Wave 29 só calcula margem quando existe ao menos uma fonte obrigatória de custo variável e todas as fontes cobrem integralmente a janela. Ausência de custo não é tratada como zero.
                  </p>
                </div>
              )}
              <section className="admin-revenue-economics-summary" aria-label="Resumo da economia do recebimento">
                <MetricCard label="Bruto reconciliado" hint="pagamentos com evidência econômica" value={formatCurrency(economics.valorBrutoReconciliado)} />
                <MetricCard label="Taxas observadas" hint="taxas conhecidas do gateway" value={formatCurrency(economics.taxasGatewayObservadas)} />
                <MetricCard label="Estornos concluídos" hint="reversões já reconciliadas" tone={number(economics.estornosConcluidos) > 0 ? "warning" : "neutral"} value={formatCurrency(economics.estornosConcluidos)} />
                <MetricCard label="Líquido do gateway" hint="não equivale a lucro" tone={number(economics.receitaLiquidaGateway) > 0 ? "success" : "neutral"} value={formatCurrency(economics.receitaLiquidaGateway)} />
              </section>
              <details className="admin-revenue-detail" open={number(economics.pagamentosIncompletos) > 0}>
                <summary>Detalhes de cobertura e margem</summary>
                <dl className="admin-command-data-list">
                <div><dt>Valor bruto reconciliado</dt><dd>{formatCurrency(economics.valorBrutoReconciliado)}</dd></div>
                <div><dt>Taxas gateway observadas</dt><dd>{formatCurrency(economics.taxasGatewayObservadas)}</dd></div>
                <div><dt>Estornos concluídos</dt><dd>{formatCurrency(economics.estornosConcluidos)}</dd></div>
                <div><dt>Receita líquida de gateway</dt><dd>{formatCurrency(economics.receitaLiquidaGateway)}</dd></div>
                <div><dt>Pagamentos completos</dt><dd>{formatNumber(economics.pagamentosCompletos)}</dd></div>
                <div><dt>Pagamentos incompletos</dt><dd>{formatNumber(economics.pagamentosIncompletos)}</dd></div>
                <div>
                  <dt>Custos variáveis observados</dt>
                  <dd>
                    {contribution.margemContribuicaoDisponivel
                      ? formatCurrency(contribution.custosVariaveisObservados)
                      : "Indisponível"}
                  </dd>
                </div>
                <div>
                  <dt>Margem de contribuição</dt>
                  <dd>
                    {contribution.margemContribuicaoDisponivel
                      ? formatCurrency(contribution.margemContribuicao)
                      : "Indisponível"}
                  </dd>
                </div>
                <div>
                  <dt>Margem de contribuição %</dt>
                  <dd>
                    {contribution.margemContribuicaoDisponivel
                      ? formatPercent(contribution.margemContribuicaoPercentual)
                      : "Indisponível"}
                  </dd>
                </div>
                <div>
                  <dt>Fontes de custo cobertas</dt>
                  <dd>
                    {formatNumber(contribution.fontesCobertas)}
                    {" / "}
                    {formatNumber(contribution.fontesObrigatorias)}
                  </dd>
                </div>
              </dl>
                <p className="muted">
                  Cobertura canônica desde {formatDateTime(economics.inicioCobertura)}. Ausência de netValue não é interpretada como taxa zero.
                </p>
              </details>
            </section>

            <section className="admin-revenue-cost-ops" aria-label="Operação de custos factuais">
              <div className="admin-revenue-cost-ops-heading">
                <p className="eyebrow">Custos factuais</p>
                <h2>Fontes e sincronização</h2>
                <p className="muted">Configuração operacional necessária para liberar margem de contribuição. Mantenha apenas fontes sustentadas por contrato, fatura ou regra factual verificável.</p>
              </div>
              <AdminContributionOperationsPanel />
              <AdminContributionSyncPanel />
            </section>

            <div className="admin-command-two-column admin-revenue-checkout-grid">
              <section className="panel admin-revenue-checkout-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Coorte de checkout</p>
                    <h2>Da intenção à assinatura paga</h2>
                    <p className="muted">A taxa acompanha os mesmos negócios que iniciaram checkout no período.</p>
                  </div>
                </div>
                <dl className="admin-command-data-list">
                  <div><dt>Negócios que iniciaram checkout</dt><dd>{formatNumber(summary.negociosComCheckoutCohorte)}</dd></div>
                  <div><dt>Já converteram em assinatura paga</dt><dd>{formatNumber(summary.negociosCheckoutConvertidos)}</dd></div>
                  <div><dt>Checkout → assinatura paga</dt><dd>{formatPercent(summary.conversaoCheckoutParaAssinaturaPaga)}</dd></div>
                </dl>
              </section>

              <section className="panel admin-revenue-checkout-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Processamento técnico</p>
                    <h2>Tentativas de checkout</h2>
                  </div>
                </div>
                <dl className="admin-command-data-list">
                  <div><dt>Checkouts iniciados</dt><dd>{formatNumber(summary.checkoutsIniciados)}</dd></div>
                  <div><dt>Concluídos tecnicamente</dt><dd>{formatNumber(summary.checkoutsConcluidos)}</dd></div>
                  <div><dt>Com falha</dt><dd>{formatNumber(summary.checkoutsFalhos)}</dd></div>
                </dl>
              </section>
            </div>

            <section className="panel admin-revenue-facts-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Fatos financeiros</p>
                  <h2>O que aconteceu no período</h2>
                </div>
              </div>
              <dl className="admin-command-data-list">
                <div><dt>Novos negócios pagantes</dt><dd>{formatNumber(summary.novosNegociosPagantes)}</dd></div>
                <div><dt>Pagamentos de renovação</dt><dd>{formatNumber(summary.pagamentosRenovacao)}</dd></div>
                <div><dt>Negócios com renovação</dt><dd>{formatNumber(summary.negociosComRenovacao)}</dd></div>
                <div><dt>Pagamentos de mudança de plano</dt><dd>{formatNumber(summary.pagamentosMudancaPlano)}</dd></div>
                <div><dt>Pagamentos confirmados</dt><dd>{formatNumber(summary.pagamentosConfirmados)}</dd></div>
                <div><dt>Negócios com pagamento</dt><dd>{formatNumber(summary.negociosPagantes)}</dd></div>
              </dl>
            </section>

            <section className="panel admin-revenue-retention-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Retenção financeira</p>
                  <h2>Renovações vencidas no período</h2>
                  <p className="muted">
                    Cancelar a próxima renovação, atrasar uma cobrança e perder o acesso pago são fatos diferentes.
                  </p>
                </div>
              </div>
              <section className="admin-revenue-retention-summary" aria-label="Resumo de retenção financeira">
                <MetricCard label="Previstas" hint="renovações vencidas no período" value={formatNumber(summary.renovacoesPrevistas)} />
                <MetricCard label="Confirmadas" hint="renovações pagas observadas" tone={number(summary.renovacoesConfirmadas) > 0 ? "success" : "neutral"} value={formatNumber(summary.renovacoesConfirmadas)} />
                <MetricCard label="Taxa de renovação" hint="sobre a coorte prevista" value={formatPercent(summary.taxaRenovacao)} />
                <MetricCard label="Em atraso" hint="atraso não equivale a churn" tone={number(summary.renovacoesComAtraso) > 0 ? "warning" : "neutral"} value={formatNumber(summary.renovacoesComAtraso)} />
              </section>
              <details className="admin-revenue-detail">
                <summary>Recuperação e cancelamentos</summary>
                <dl className="admin-command-data-list">
                <div><dt>Renovações previstas</dt><dd>{formatNumber(summary.renovacoesPrevistas)}</dd></div>
                <div><dt>Renovações confirmadas</dt><dd>{formatNumber(summary.renovacoesConfirmadas)}</dd></div>
                <div><dt>Taxa observada de renovação</dt><dd>{formatPercent(summary.taxaRenovacao)}</dd></div>
                <div><dt>Renovações com atraso observado</dt><dd>{formatNumber(summary.renovacoesComAtraso)}</dd></div>
                <div><dt>Renovações recuperadas</dt><dd>{formatNumber(summary.renovacoesRecuperadas)}</dd></div>
                <div><dt>Taxa observada de recuperação</dt><dd>{formatPercent(summary.taxaRecuperacaoRenovacao)}</dd></div>
                <div><dt>Cancelamentos de renovação agendados</dt><dd>{formatNumber(summary.cancelamentosRenovacaoAgendados)}</dd></div>
                <div><dt>Encerradas após cancelamento</dt><dd>{formatNumber(summary.assinaturasEncerradasAposCancelamento)}</dd></div>
              </dl>
              </details>
            </section>

            <section className="panel admin-revenue-lifecycle-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Lifecycle canônico</p>
                  <h2>Transições pagas registradas desde a Wave 22</h2>
                  <p className="muted">
                    Histórico append-only: sem backfill especulativo e sem chamar atraso ou cancelamento agendado de churn.
                  </p>
                </div>
              </div>
              <section className="admin-revenue-lifecycle-summary" aria-label="Resumo do lifecycle pago">
                <MetricCard label="Conversões iniciais" hint="entradas pagas canônicas" value={formatNumber(summary.conversoesIniciaisCanonicas)} />
                <MetricCard label="Renovações" hint="renovações confirmadas" value={formatNumber(summary.renovacoesConfirmadasCanonicas)} />
                <MetricCard label="Reativações" hint="retornos pagos" value={formatNumber(summary.reativacoesPagas)} />
                <MetricCard label="Saídas da base paga" hint="saídas canônicas observadas" tone={number(summary.saidasBasePagaCanonicas) > 0 ? "warning" : "neutral"} value={formatNumber(summary.saidasBasePagaCanonicas)} />
              </section>
              <details className="admin-revenue-detail">
                <summary>Ver todas as transições financeiras</summary>
                <dl className="admin-command-data-list">
                <div><dt>Conversões iniciais</dt><dd>{formatNumber(summary.conversoesIniciaisCanonicas)}</dd></div>
                <div><dt>Renovações confirmadas</dt><dd>{formatNumber(summary.renovacoesConfirmadasCanonicas)}</dd></div>
                <div><dt>Reativações pagas</dt><dd>{formatNumber(summary.reativacoesPagas)}</dd></div>
                <div><dt>Mudanças de plano</dt><dd>{formatNumber(summary.mudancasPlanoCanonicas)}</dd></div>
                <div><dt>Pagamentos atrasados</dt><dd>{formatNumber(summary.pagamentosAtrasadosCanonicos)}</dd></div>
                <div><dt>Pagamentos recuperados</dt><dd>{formatNumber(summary.pagamentosRecuperadosCanonicos)}</dd></div>
                <div><dt>Reversões financeiras</dt><dd>{formatNumber(summary.reversoesFinanceirasCanonicas)}</dd></div>
                <div><dt>Renovações canceladas</dt><dd>{formatNumber(summary.cancelamentosRenovacaoCanonicos)}</dd></div>
                <div><dt>Saídas da base paga</dt><dd>{formatNumber(summary.saidasBasePagaCanonicas)}</dd></div>
                <div><dt>Pendentes de reconciliação temporal</dt><dd>{formatNumber(summary.cancelamentosVencidosPendentesReconciliacao)}</dd></div>
              </dl>
              </details>
            </section>

            <section className="panel admin-revenue-mrr-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Receita recorrente</p>
                  <h2>Receita recorrente canônica</h2>
                  <p className="muted">
                    MRR representa valor recorrente mensal contratado no ledger do AF. Não é o mesmo que caixa recebido no período.
                  </p>
                </div>
              </div>

              {data.mrr?.confiavel === false && (
                <div className="admin-command-alert is-warning" role="status">
                  <strong>Leitura de MRR com diagnóstico pendente.</strong>
                  <p className="muted">
                    Verifique a reconciliação do bridge e recorrências com periodicidade ainda não suportada antes de usar NRR ou GRR como referência.
                  </p>
                </div>
              )}

              <section className="admin-revenue-mrr-summary" aria-label="Resumo de receita recorrente">
                <MetricCard label="MRR final" hint="valor recorrente mensal contratado" tone={number(summary.mrrFinalTotal) > 0 ? "success" : "neutral"} value={formatCurrency(summary.mrrFinalTotal)} />
                <MetricCard label="New MRR" hint="nova receita recorrente" value={formatCurrency(summary.newMrr)} />
                <MetricCard label="MRR em risco" hint={`${formatNumber(summary.negociosMrrEmRisco)} negócio(s) em risco`} tone={number(summary.mrrEmRisco) > 0 ? "warning" : "neutral"} value={formatCurrency(summary.mrrEmRisco)} />
                <MetricCard label="NRR" hint="retenção líquida de receita" value={formatPercent(summary.nrr)} />
              </section>
              <details className="admin-revenue-detail">
                <summary>Bridge, GRR e movimentos do MRR</summary>
                <dl className="admin-command-data-list">
                  <div><dt>MRR da base inicial</dt><dd>{formatCurrency(summary.mrrInicial)}</dd></div>
                  <div><dt>New MRR</dt><dd>{formatCurrency(summary.newMrr)}</dd></div>
                  <div><dt>Expansion MRR</dt><dd>{formatCurrency(summary.expansionMrr)}</dd></div>
                  <div><dt>Contraction MRR</dt><dd>{formatCurrency(summary.contractionMrr)}</dd></div>
                  <div><dt>Churned MRR</dt><dd>{formatCurrency(summary.churnedMrr)}</dd></div>
                  <div><dt>Reactivation MRR</dt><dd>{formatCurrency(summary.reactivationMrr)}</dd></div>
                  <div><dt>MRR final</dt><dd>{formatCurrency(summary.mrrFinalTotal)}</dd></div>
                  <div><dt>MRR em risco</dt><dd>{formatCurrency(summary.mrrEmRisco)}</dd></div>
                  <div><dt>Negócios com MRR em risco</dt><dd>{formatNumber(summary.negociosMrrEmRisco)}</dd></div>
                  <div><dt>GRR</dt><dd>{formatPercent(summary.grr)}</dd></div>
                  <div><dt>NRR</dt><dd>{formatPercent(summary.nrr)}</dd></div>
                  <div><dt>Bridge reconciliado</dt><dd>{summary.bridgeMrrReconciliado ? "Sim" : "Não"}</dd></div>
                  <div><dt>Periodicidade fora do MRR v1</dt><dd>{formatNumber(summary.assinaturasPeriodicidadeNaoSuportada)}</dd></div>
                </dl>
              </details>

              <p className="muted">
                Cobertura monetária canônica desde {formatDateTime(data.mrr?.inicioCobertura)}.
                {data.mrr?.periodoAjustadoAoCutover
                  ? " O início deste recorte foi ajustado ao cutover da Wave 25."
                  : " O histórico anterior ao cutover não foi inferido."}
              </p>
            </section>

            <section className="panel admin-revenue-ltv-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Coortes de receita</p>
                  <h2>LTV bruto observado</h2>
                  <p className="muted">
                    Receita acumulada por negócio desde a primeira conversão paga canônica. A leitura usa D30, D60 e D90 maduros e não projeta lifetime futuro.
                  </p>
                </div>
              </div>

              <section className="admin-revenue-ltv-summary" aria-label="Resumo de LTV observado">
                <MetricCard label="Coorte canônica" hint="negócios elegíveis" value={formatNumber(ltv.negociosCoorte)} />
                <MetricCard label="LTV bruto D30" hint={`${formatNumber(ltv.madurosD30)} negócio(s) maduros`} value={ltv.ltvBrutoD30 == null ? "Aguardando" : formatCurrency(ltv.ltvBrutoD30)} />
                <MetricCard label="LTV bruto D60" hint={`${formatNumber(ltv.madurosD60)} negócio(s) maduros`} value={ltv.ltvBrutoD60 == null ? "Aguardando" : formatCurrency(ltv.ltvBrutoD60)} />
                <MetricCard label="LTV bruto D90" hint={`${formatNumber(ltv.madurosD90)} negócio(s) maduros`} value={ltv.ltvBrutoD90 == null ? "Aguardando" : formatCurrency(ltv.ltvBrutoD90)} />
              </section>
              <details className="admin-revenue-detail">
                <summary>LTV líquido, contribuição e maturidade</summary>
                <dl className="admin-command-data-list">
                <div>
                  <dt>Negócios na coorte canônica</dt>
                  <dd>{formatNumber(ltv.negociosCoorte)}</dd>
                </div>
                <div>
                  <dt>LTV bruto D30</dt>
                  <dd>{ltv.ltvBrutoD30 == null ? "Aguardando maturidade" : formatCurrency(ltv.ltvBrutoD30)}</dd>
                </div>
                <div>
                  <dt>Amostra madura D30</dt>
                  <dd>{formatNumber(ltv.madurosD30)}</dd>
                </div>
                <div>
                  <dt>LTV bruto D60</dt>
                  <dd>{ltv.ltvBrutoD60 == null ? "Aguardando maturidade" : formatCurrency(ltv.ltvBrutoD60)}</dd>
                </div>
                <div>
                  <dt>Amostra madura D60</dt>
                  <dd>{formatNumber(ltv.madurosD60)}</dd>
                </div>
                <div>
                  <dt>LTV bruto D90</dt>
                  <dd>{ltv.ltvBrutoD90 == null ? "Aguardando maturidade" : formatCurrency(ltv.ltvBrutoD90)}</dd>
                </div>
                <div>
                  <dt>Amostra madura D90</dt>
                  <dd>{formatNumber(ltv.madurosD90)}</dd>
                </div>
                <div>
                  <dt>Valor exposto a reversões</dt>
                  <dd>{formatCurrency(ltv.valorExpostoReversoes)}</dd>
                </div>
                <div>
                  <dt>LTV líquido gateway D30</dt>
                  <dd>{ltv.ltvLiquidoGatewayD30 == null ? "Aguardando cobertura econômica" : formatCurrency(ltv.ltvLiquidoGatewayD30)}</dd>
                </div>
                <div>
                  <dt>LTV líquido gateway D60</dt>
                  <dd>{ltv.ltvLiquidoGatewayD60 == null ? "Aguardando cobertura econômica" : formatCurrency(ltv.ltvLiquidoGatewayD60)}</dd>
                </div>
                <div>
                  <dt>LTV líquido gateway D90</dt>
                  <dd>{ltv.ltvLiquidoGatewayD90 == null ? "Aguardando cobertura econômica" : formatCurrency(ltv.ltvLiquidoGatewayD90)}</dd>
                </div>
                <div>
                  <dt>LTV contribuição D30</dt>
                  <dd>{ltv.ltvContribuicaoD30 == null ? "Aguardando cobertura de contribuição" : formatCurrency(ltv.ltvContribuicaoD30)}</dd>
                </div>
                <div>
                  <dt>LTV contribuição D60</dt>
                  <dd>{ltv.ltvContribuicaoD60 == null ? "Aguardando cobertura de contribuição" : formatCurrency(ltv.ltvContribuicaoD60)}</dd>
                </div>
                <div>
                  <dt>LTV contribuição D90</dt>
                  <dd>{ltv.ltvContribuicaoD90 == null ? "Aguardando cobertura de contribuição" : formatCurrency(ltv.ltvContribuicaoD90)}</dd>
                </div>
              </dl>
              </details>

              <p className="muted">
                Cobertura canônica desde {formatDateTime(ltv.inicioCobertura)}. LTV de contribuição possui cutover próprio em {formatDateTime(ltv.inicioCoberturaContribuicao)} e só aparece quando gateway e todas as fontes obrigatórias cobrem a janela inteira. Casos maduros incompletos não são removidos do denominador.
              </p>

              {ltvCohorts.length === 0 ? (
                <EmptyState title="Aguardando primeira coorte paga pós-cutover">
                  Ainda não existe negócio elegível para LTV canônico da Wave 26.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Coorte paga</th>
                        <th>Negócios</th>
                        <th>D30</th>
                        <th>D60</th>
                        <th>D90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ltvCohorts.map((cohort) => (
                        <tr key={cohort.coorteMes}>
                          <td><strong>{cohort.coorteMes}</strong></td>
                          <td>{formatNumber(cohort.negocios)}</td>
                          <td>
                            {cohort.ltvBrutoD30 == null
                              ? "Aguardando"
                              : formatCurrency(cohort.ltvBrutoD30)}
                            <small>{formatNumber(cohort.madurosD30)} maduros</small>
                          </td>
                          <td>
                            {cohort.ltvBrutoD60 == null
                              ? "Aguardando"
                              : formatCurrency(cohort.ltvBrutoD60)}
                            <small>{formatNumber(cohort.madurosD60)} maduros</small>
                          </td>
                          <td>
                            {cohort.ltvBrutoD90 == null
                              ? "Aguardando"
                              : formatCurrency(cohort.ltvBrutoD90)}
                            <small>{formatNumber(cohort.madurosD90)} maduros</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel admin-revenue-churn-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Retenção da base paga</p>
                  <h2>Churn bruto de negócios</h2>
                  <p className="muted">
                    A leitura usa episódios pagos canônicos desde a Wave 24. Reativação é exibida separadamente e não reduz o churn bruto.
                  </p>
                </div>
              </div>
              <section className="admin-revenue-churn-summary" aria-label="Resumo de churn da base paga">
                <MetricCard label="Base inicial" hint="negócios pagos no início" value={formatNumber(summary.basePagaInicioChurn)} />
                <MetricCard label="Saídas terminais" hint="saídas da base inicial" tone={number(summary.saidasTerminaisBaseInicial) > 0 ? "warning" : "neutral"} value={formatNumber(summary.saidasTerminaisBaseInicial)} />
                <MetricCard label="Gross logo churn" hint="reativação não reduz churn bruto" value={formatPercent(summary.churnBrutoNegocios)} />
                <MetricCard label="Base final" hint="negócios pagos no fim" value={formatNumber(summary.basePagaFimChurn)} />
              </section>
              <details className="admin-revenue-detail">
                <summary>Reativações e motivos de saída</summary>
                <dl className="admin-command-data-list">
                  <div><dt>Negócios reativados</dt><dd>{formatNumber(summary.negociosReativadosChurn)}</dd></div>
                  <div><dt>Cancelamento voluntário</dt><dd>{formatNumber(summary.saidasCancelamentoVoluntario)}</dd></div>
                  <div><dt>Inadimplência não recuperada</dt><dd>{formatNumber(summary.saidasInadimplenciaNaoRecuperada)}</dd></div>
                  <div><dt>Encerramento pelo provedor</dt><dd>{formatNumber(summary.saidasEncerramentoProvedor)}</dd></div>
                  <div><dt>Outros motivos</dt><dd>{formatNumber(summary.saidasOutrosMotivos)}</dd></div>
                </dl>
              </details>
              <p className="muted">
                Cobertura canônica desde {formatDateTime(data.churn?.inicioCobertura)}.
                {data.churn?.periodoAjustadoAoCutover
                  ? " O início deste recorte foi ajustado ao cutover; o histórico anterior não foi inferido."
                  : " O histórico anterior ao cutover não foi inferido."}
              </p>
            </section>

            <section className="panel admin-revenue-plans-panel">
              <div className="panel-heading"><div><p className="eyebrow">Base atual</p><h2>Assinaturas ativas por plano</h2><p className="muted">Estoque atual de assinaturas pagas, separado dos eventos financeiros do período.</p></div></div>
              {plans.length === 0 ? (
                <EmptyState title="Nenhuma assinatura paga ativa">A base paga ativa ainda está vazia.</EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Plano</th><th>Assinaturas ativas</th><th>Valor mensal contratado</th></tr></thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id}>
                          <td><strong>{plan.nome}</strong><small>{plan.slug}</small></td>
                          <td>{formatNumber(plan.assinaturas_ativas)}</td>
                          <td>{formatCurrency(plan.valor_mensal_contratado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <details className="admin-metric-definition">
              <summary>Critérios financeiros</summary>
              <p>{data.metodologia?.checkout}</p>
              <p>{data.metodologia?.conversaoCheckout}</p>
              <p>{data.metodologia?.novaAssinatura}</p>
              <p>{data.metodologia?.receita}</p>
              <p>{data.metodologia?.classificacaoReceita}</p>
              <p>{data.metodologia?.retencaoFinanceira}</p>
              <p>{data.metodologia?.cancelamento}</p>
              <p>{data.metodologia?.lifecycleCanonico}</p>
              <p>{data.metodologia?.churn}</p>
              <p>{data.metodologia?.mrr}</p>
              <p>{data.metodologia?.nrr}</p>
              <p>{data.metodologia?.ltv}</p>
              <p>{data.metodologia?.economiaLiquida}</p>
              <p>{data.metodologia?.contribuicao}</p>
              <p>{data.metodologia?.ativas}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}
