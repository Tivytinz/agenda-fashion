import { EmptyState } from "../components/ScreenState";
import { PAGE_LABELS, EVENT_LABELS, PIPELINE_RECONCILIATION_LABELS } from "../features/admin-analytics/labels";
import { number, formatNumber, formatPercent, formatSeconds, formatDateTime } from "../features/admin-analytics/format";
import { MetricCard, AdminSectionFrame } from "../features/admin-analytics/components";
import { useAdminSection } from "../features/admin-analytics/useAdminSection";

export function AdminJourneyV2Page() {
  const state = useAdminSection("journey");

  return (
    <AdminSectionFrame
      description="Onde as pessoas entram, quanto tempo realmente ficam com a página visível e para onde seguem."
      eyebrow="Produto"
      state={state}
      title="Jornada"
    >
      {(data) => {
        const screens = Array.isArray(data.telas) ? data.telas : [];
        const transitions = Array.isArray(data.transicoes) ? data.transicoes : [];
        const events = Array.isArray(data.eventos) ? data.eventos : [];
        const devices = Array.isArray(data.dispositivos) ? data.dispositivos : [];
        const signup = data.cadastroProfissional || null;
        const reconciliation = data.reconciliacaoPipelines || {};
        const conversionHealth = data.saudeConversoesMarketing || {};
        const conversionSummary = conversionHealth.resumo || {};
        const conversionReconciliation = data.reconciliacaoConversoesMarketing || {};
        const reconciledProviders = Array.isArray(conversionReconciliation.provedores)
          ? conversionReconciliation.provedores
          : [];
        const conversionProviders = Array.isArray(conversionHealth.provedores)
          ? conversionHealth.provedores
          : [];
        const decommissionEvidence =
          reconciliation.evidenciaRetirada || {};
        const pipelineEvents = Array.isArray(reconciliation.eventos)
          ? reconciliation.eventos
          : [];
        const screenTotals = screens.reduce((acc, screen) => ({
          visualizacoes: acc.visualizacoes + number(screen.visualizacoes),
          sessoes: acc.sessoes + number(screen.sessoes),
          tempoPonderado: acc.tempoPonderado + (
            number(screen.tempo_medio_segundos) * number(screen.sessoes)
          )
        }), { visualizacoes: 0, sessoes: 0, tempoPonderado: 0 });
        const maxScreenViews = Math.max(
          1,
          ...screens.map((screen) => number(screen.visualizacoes))
        );
        const maxTransitions = Math.max(
          1,
          ...transitions.map((item) => number(item.transicoes))
        );
        const totalTransitionEvents = transitions.reduce(
          (total, item) => total + number(item.transicoes),
          0
        );
        const crossScreenTransitions = transitions.reduce(
          (total, item) => total + (
            item.origem !== item.destino ? number(item.transicoes) : 0
          ),
          0
        );
        const totalIntentEvents = events.reduce(
          (total, event) => total + number(event.eventos),
          0
        );
        const intentSessions = events.reduce(
          (total, event) => total + number(event.sessoes),
          0
        );
        const totalDeviceSessions = devices.reduce(
          (total, item) => total + number(item.sessoes),
          0
        );
        const deviceSessions = devices.reduce((acc, item) => {
          const key = String(item.device_type || "other").toLowerCase();
          acc[key] = (acc[key] || 0) + number(item.sessoes);
          return acc;
        }, {});
        const mobileSessions = number(deviceSessions.mobile);
        const desktopSessions = number(deviceSessions.desktop);
        const maxCompatibilitySessions = Math.max(
          1,
          ...devices.map((item) => number(item.sessoes))
        );
        const hasPipelineEvidence =
          pipelineEvents.some((item) => (
            number(item.legadoPeriodo) > 0 ||
            number(item.v2Periodo) > 0
          ));

        if (
          screens.length === 0 &&
          events.length === 0 &&
          !hasPipelineEvidence
        ) {
          return (
            <EmptyState title="A jornada first-party começa a ser construída nesta versão">
              Não há backfill artificial de páginas ou tempo de permanência. Assim que houver novas sessões, esta área passa a mostrar caminhos reais.
            </EmptyState>
          );
        }

        return (
          <>
            {number(signup?.sessoes_visita) > 0 && (
              <section className="panel admin-journey-signup-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Ativação</p>
                    <h2>Cadastro profissional — interação com o formulário</h2>
                    <p className="muted">
                      Coorte de sessões que visualizaram o cadastro profissional no período.
                      Os eventos precisam pertencer a essa visualização. Não equivalem a contas criadas.
                    </p>
                  </div>
                </div>
                <section className="admin-command-summary-grid is-period-summary" aria-label="Etapas do cadastro profissional">
                  <MetricCard label="Sessões com visita" hint="sessões com a página de cadastro profissional" value={formatNumber(signup.sessoes_visita)} />
                  <MetricCard label="Iniciaram" hint="sessões com primeira interação registrada" value={formatNumber(signup.sessoes_inicio)} />
                  <MetricCard label="Tentaram cadastrar" hint="sessões com envio de dados válidos ao servidor ou credencial Google" value={formatNumber(signup.sessoes_envio)} />
                  <MetricCard label="Encontraram erro de campo" hint="sessões com erros de validação observados" value={formatNumber(signup.sessoes_erro)} />
                  <MetricCard label="Falha de solicitação" hint="sessões com falha HTTP ou resultado do fluxo não confirmado; isso não comprova que a conta não foi criada" value={formatNumber(signup.sessoes_erro_requisicao)} />
                </section>
                <p className="muted">
                  Tentativas por método: e-mail {formatNumber(signup.sessoes_envio_email)} sessão(ões),
                  {" "}Google {formatNumber(signup.sessoes_envio_google)} sessão(ões).
                  Uma mesma sessão pode tentar os dois métodos: não somar estes valores.
                </p>
                <p className="muted">
                  {formatNumber(signup.erros_validacao)} ocorrência(s) de validação e
                  {" "}{formatNumber(signup.erros_requisicao)} problema(s) de solicitação observados no período.
                  Uma sessão pode conter vários eventos. Falha de solicitação não prova que a conta não foi criada.
                  Cadastros concluídos, negócios e primeiros agendamentos permanecem no funil operacional,
                  confirmado pelo backend. Não atribuir abandono apenas por ausência de evento.
                </p>
              </section>
            )}
            <section className="panel admin-journey-screens-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Telas</p>
                  <h2>Onde as pessoas passam tempo</h2>
                  <p className="muted">Compare alcance e atenção por tela. Visualização não representa conversão; use os caminhos e marcos abaixo para interpretar intenção.</p>
                </div>
              </div>
              {screens.length > 0 && (
                <section className="admin-journey-screen-summary" aria-label="Resumo das telas">
                  <MetricCard label="Visualizações" hint="aberturas de tela no período" value={formatNumber(screenTotals.visualizacoes)} />
                  <MetricCard label="Sessões nas telas" hint="soma das sessões por tela; não é usuário único" value={formatNumber(screenTotals.sessoes)} />
                  <MetricCard label="Telas observadas" hint="rotas com evidência first-party" value={formatNumber(screens.length)} />
                  <MetricCard label="Tempo médio visível" hint="média ponderada pelas sessões exibidas" value={screenTotals.sessoes > 0 ? formatSeconds(screenTotals.tempoPonderado / screenTotals.sessoes) : "—"} />
                </section>
              )}
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Tela</th><th>Visualizações</th><th>Sessões</th><th>Tempo médio visível</th></tr></thead>
                  <tbody>
                    {screens.map((screen) => (
                      <tr key={screen.page_key}>
                        <td><strong>{PAGE_LABELS[screen.page_key] || screen.page_key}</strong><small>{screen.route_template}</small></td>
                        <td>
                          <div className="admin-screen-volume">
                            <strong>{formatNumber(screen.visualizacoes)}</strong>
                            <span aria-hidden="true"><i style={{ width: `${Math.max(4, (number(screen.visualizacoes) / maxScreenViews) * 100)}%` }} /></span>
                          </div>
                        </td>
                        <td>{formatNumber(screen.sessoes)}</td>
                        <td>{formatSeconds(screen.tempo_medio_segundos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="admin-command-two-column admin-journey-insights">
              <section className="panel admin-journey-paths-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Caminhos</p>
                    <h2>Transições mais comuns</h2>
                    <p className="muted">Mostra mudanças observadas entre telas. Repetições na mesma tela são preservadas, mas não são tratadas como avanço da jornada.</p>
                  </div>
                </div>
                {transitions.length === 0 ? <p className="muted">Ainda não há sessões com duas ou mais telas.</p> : (
                  <>
                    <div className="admin-journey-mini-summary" aria-label="Resumo dos caminhos">
                      <span><strong>{formatNumber(totalTransitionEvents)}</strong> transições observadas</span>
                      <span><strong>{formatNumber(crossScreenTransitions)}</strong> entre telas diferentes</span>
                    </div>
                    <div className="admin-ranking-list admin-journey-ranking">
                      {transitions.map((item) => {
                        const sameScreen = item.origem === item.destino;
                        return (
                          <article key={`${item.origem}-${item.destino}`} className={sameScreen ? "is-same-screen" : ""}>
                            <div>
                              <strong>{PAGE_LABELS[item.origem] || item.origem} → {PAGE_LABELS[item.destino] || item.destino}</strong>
                              <small>{sameScreen ? "Mesma tela · não indica avanço" : "Mudança entre telas"}</small>
                              <span className="admin-journey-path-bar" aria-hidden="true">
                                <i style={{ width: `${Math.max(4, (number(item.transicoes) / maxTransitions) * 100)}%` }} />
                              </span>
                            </div>
                            <span>{formatNumber(item.transicoes)} <small>transições</small></span>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section className="panel admin-journey-intent-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Marcos de intenção</p>
                    <h2>Ações observadas no navegador</h2>
                    <p className="muted">Eventos first-party que sinalizam interesse ou avanço. Evento, sessão e conversão continuam sendo fatos diferentes.</p>
                  </div>
                </div>
                {events.length === 0 ? <p className="muted">Nenhum marco frontend neste recorte.</p> : (
                  <>
                    <div className="admin-journey-mini-summary" aria-label="Resumo dos marcos de intenção">
                      <span><strong>{formatNumber(totalIntentEvents)}</strong> eventos observados</span>
                      <span><strong>{formatNumber(intentSessions)}</strong> sessões somadas por marco</span>
                    </div>
                    <div className="admin-intent-list">
                      {events.map((event) => (
                        <article key={event.nome}>
                          <div>
                            <strong>{EVENT_LABELS[event.nome] || event.nome}</strong>
                            <small>{event.nome === "profile_viewed"
                              ? "Interesse em um perfil"
                              : event.nome === "booking_completed"
                                ? "Agendamento concluído no frontend; validar no booking real"
                                : "Marco first-party observado"}</small>
                          </div>
                          <div className="admin-intent-metrics">
                            <strong>{formatNumber(event.eventos)}</strong>
                            <small>eventos · {formatNumber(event.sessoes)} sessões</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Migração de analytics</p>
                  <h2>Reconciliação legado × V2</h2>
                  <p className="muted">
                    {PIPELINE_RECONCILIATION_LABELS[reconciliation.estado] || reconciliation.estado || "Sem diagnóstico"}
                    {reconciliation.inicioComparavel
                      ? ` · comparação desde ${formatDateTime(reconciliation.inicioComparavel)}`
                      : ""}
                  </p>
                </div>
              </div>

              <section className="admin-command-summary-grid is-period-summary">
                <MetricCard
                  label="Dias com evidência"
                  hint="dias observados desde o início comparável"
                  value={formatNumber(decommissionEvidence.diasComEvidencia)}
                />
                <MetricCard
                  label="Divergências diárias"
                  hint="pares dia × evento com contagens diferentes"
                  tone={number(decommissionEvidence.paresDiaEventoDivergentes) > 0 ? "warning" : "neutral"}
                  value={formatNumber(decommissionEvidence.paresDiaEventoDivergentes)}
                />
                <MetricCard
                  label="Booking vinculado"
                  hint="booking_completed V2 ligado a booking real"
                  value={formatPercent(decommissionEvidence.coberturaBookingCompletedVinculado)}
                />
                <MetricCard
                  label="Gate de retirada"
                  hint="evidência técnica; decisão operacional continua explícita"
                  tone={decommissionEvidence.prontaParaAvaliacao ? "success" : "warning"}
                  value={decommissionEvidence.prontaParaAvaliacao ? "Avaliar retirada" : "Manter legado"}
                />
              </section>

              {decommissionEvidence.observacao && (
                <p className="muted">{decommissionEvidence.observacao}</p>
              )}

              {pipelineEvents.length === 0 ? (
                <p className="muted">Nenhum evento comparável foi retornado.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Legado</th>
                        <th>Analytics V2</th>
                        <th>Diferença</th>
                        <th>Cobertura V2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineEvents.map((item) => (
                        <tr key={item.evento}>
                          <td>
                            <strong>{EVENT_LABELS[item.evento] || item.evento}</strong>
                            {item.evento === "booking_completed" && (
                              <small>
                                {formatNumber(item.bookingCompletedVinculados)} conclusão(ões) V2 vinculada(s) ao booking real
                              </small>
                            )}
                          </td>
                          <td>{formatNumber(item.legadoComparavel)}</td>
                          <td>{formatNumber(item.v2Comparavel)}</td>
                          <td>{number(item.diferencaEventos) > 0 ? "+" : ""}{formatNumber(item.diferencaEventos)}</td>
                          <td>{formatPercent(item.coberturaV2SobreLegado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="admin-metric-definition">
                <summary>Como interpretar a reconciliação</summary>
                <p>{reconciliation.metodologia?.comparacao}</p>
                <p>{reconciliation.metodologia?.eventos}</p>
                <p>{reconciliation.metodologia?.decisao}</p>
              </details>
            </section>

            <section className="panel admin-conversion-reconciliation-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Reconciliação de receita × marketing</p>
                  <h2>Pagamento → entrega → Google / Meta</h2>
                  <p className="muted">
                    Parte da primeira conversão paga canônica de cada negócio. Privacidade, indisponibilidade da integração e falhas técnicas aparecem separadamente.
                  </p>
                </div>
              </div>
              {reconciledProviders.length === 0 ? (
                <p className="muted">Ainda não há conversões pagas no período para reconciliar.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Provedor</th>
                        <th>Pagas</th>
                        <th>Enviadas</th>
                        <th>Sem consentimento</th>
                        <th>Integração indisponível</th>
                        <th>Divergência financeira</th>
                        <th>Em processamento</th>
                        <th>Perdas técnicas</th>
                        <th>Sem entrega</th>
                        <th>Cobertura sobre pagas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciledProviders.map((item) => (
                        <tr key={item.provedor}>
                          <td><strong>{item.provedor === "google" ? "Google" : item.provedor === "meta" ? "Meta" : item.provedor}</strong></td>
                          <td>{formatNumber(item.conversoesPagas)}</td>
                          <td>{formatNumber(item.enviadas)}</td>
                          <td>{formatNumber(item.inelegiveisLegitimas)}</td>
                          <td>{formatNumber(item.integracaoIndisponivel)}</td>
                          <td>{formatNumber(item.divergenciasFinanceiras)}</td>
                          <td>{formatNumber(item.emProcessamento)}</td>
                          <td>{formatNumber(item.perdasTecnicas)}</td>
                          <td>{formatNumber(item.semEntrega)}</td>
                          <td>{formatPercent(item.coberturaSobrePagas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <details className="admin-metric-definition">
                <summary>Como interpretar a reconciliação</summary>
                <p>{conversionReconciliation.metodologia}</p>
              </details>
            </section>

            <section className="panel admin-conversion-health-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Conversões de marketing</p>
                  <h2>Saúde da entrega Google × Meta</h2>
                  <p className="muted">
                    Estado atual da fila persistente e atividade criada no período selecionado. Pagamentos confirmados continuam sendo a fonte de verdade de receita.
                  </p>
                </div>
              </div>

              <section className="admin-command-summary-grid is-period-summary">
                <MetricCard
                  label="Estado da fila"
                  hint="falhas terminais ou leases expirados exigem investigação"
                  tone={conversionHealth.estado === "atencao" ? "warning" : conversionHealth.estado === "saudavel" ? "success" : "neutral"}
                  value={conversionHealth.estado === "atencao" ? "Atenção" : conversionHealth.estado === "saudavel" ? "Saudável" : "Processando"}
                />
                <MetricCard
                  label="Atividade no período"
                  hint="entregas criadas no recorte selecionado"
                  value={formatNumber(conversionSummary.atividadePeriodo)}
                />
                <MetricCard
                  label="Falhas terminais"
                  hint="não possuem próxima tentativa automática"
                  tone={number(conversionSummary.falhasTerminais) > 0 ? "warning" : "neutral"}
                  value={formatNumber(conversionSummary.falhasTerminais)}
                />
                <MetricCard
                  label="Leases expirados"
                  hint="processamentos presos há mais de cinco minutos"
                  tone={number(conversionSummary.processamentosExpirados) > 0 ? "warning" : "neutral"}
                  value={formatNumber(conversionSummary.processamentosExpirados)}
                />
              </section>

              {conversionProviders.length === 0 ? (
                <p className="muted">Ainda não há entregas de conversão de assinatura registradas.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Provedor</th>
                        <th>Status</th>
                        <th>Estoque atual</th>
                        <th>Atividade no período</th>
                        <th>Pendência mais antiga</th>
                        <th>Último envio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionProviders.map((item) => (
                        <tr key={`${item.provedor}-${item.status}`}>
                          <td><strong>{item.provedor === "google" ? "Google" : item.provedor === "meta" ? "Meta" : item.provedor}</strong></td>
                          <td>{item.status}</td>
                          <td>{formatNumber(item.total)}</td>
                          <td>{formatNumber(item.atividade_periodo)}</td>
                          <td>{formatDateTime(item.pendencia_mais_antiga_em)}</td>
                          <td>{formatDateTime(item.ultimo_envio_em)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="admin-metric-definition">
                <summary>Como interpretar a saúde das conversões</summary>
                <p>{conversionHealth.metodologia}</p>
              </details>
            </section>

            <section className="panel admin-compatibility-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Compatibilidade</p>
                  <h2>Dispositivo e navegador</h2>
                  <p className="muted">Distribuição das sessões observadas por combinação de dispositivo e navegador. Use este recorte para priorizar QA e compatibilidade, não para inferir conversão.</p>
                </div>
              </div>
              {devices.length === 0 ? (
                <p className="muted">Ainda não há sessões com dispositivo e navegador identificados.</p>
              ) : (
                <>
                  <section className="admin-compatibility-summary" aria-label="Resumo de compatibilidade">
                    <MetricCard label="Sessões observadas" hint="soma das combinações exibidas" value={formatNumber(totalDeviceSessions)} />
                    <MetricCard label="Mobile" hint="participação das sessões mobile" value={formatPercent(totalDeviceSessions > 0 ? (mobileSessions / totalDeviceSessions) * 100 : null)} />
                    <MetricCard label="Desktop" hint="participação das sessões desktop" value={formatPercent(totalDeviceSessions > 0 ? (desktopSessions / totalDeviceSessions) * 100 : null)} />
                    <MetricCard label="Combinações" hint="dispositivo × navegador observados" value={formatNumber(devices.length)} />
                  </section>
                  <div className="admin-compatibility-list">
                    {devices.map((item) => (
                      <article key={`${item.device_type}-${item.browser_family}`}>
                        <div className="admin-compatibility-identity">
                          <strong>{item.device_type || "other"}</strong>
                          <small>{item.browser_family || "Other"}</small>
                        </div>
                        <div className="admin-compatibility-volume">
                          <span aria-hidden="true"><i style={{ width: `${Math.max(4, (number(item.sessoes) / maxCompatibilitySessions) * 100)}%` }} /></span>
                          <strong>{formatNumber(item.sessoes)} <small>sessões</small></strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}
