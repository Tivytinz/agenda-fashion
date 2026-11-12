import { useScheduleEditor } from "../features/schedule/useScheduleEditor";
import { DAY_NAMES, DURATION_OPTIONS, INTERVAL_OPTIONS, withCurrentOption, formatLeadTime } from "../features/schedule/form";
export { summarizeSchedule, validateSchedule } from "../features/schedule/form";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { SetupFlowFrame, SetupTitle } from "../components/SetupFlowFrame";
import { buildPublicLink } from "../utils/publicLinks";
import { PublicShareButton } from "../components/PublicShareButton";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";

function CopyIcon({ className = "" }) {
  return <span aria-hidden="true" className={`native-emoji ${className}`}>📋</span>;
}

export function ScheduleSettingsPage() {
  const location = useLocation();
  const contextoAgenda = location.pathname.startsWith("/profissional/")
    ? "profissional"
    : "dono";
  const professionalContext =
    contextoAgenda === "profissional";
  const targetProfessionalId = useMemo(() => {
    if (professionalContext) return null;

    const value =
      new URLSearchParams(
        location.search
      ).get("profissional");
    const id = Number(value);

    return Number.isInteger(id) && id > 0
      ? id
      : null;
  }, [
    location.search,
    professionalContext
  ]);

  // O guard libera a navegação antes de a troca de pessoa reiniciar o editor.
  return (
    <ScheduleSettingsEditor
      contextoAgenda={contextoAgenda}
      key={`${contextoAgenda}:${targetProfessionalId ?? "self"}`}
      targetProfessionalId={targetProfessionalId}
    />
  );
}

function ScheduleSettingsEditor({ contextoAgenda, targetProfessionalId }) {
  const {
    location,
    professionalContext,
    ownerTeamSchedule,
    config,
    setConfig,
    setLoadAttempt,
    days,
    expandedPauses,
    advancedOpen,
    setAdvancedOpen,
    setupSessionRef,
    error,
    message,
    saving,
    businessContext,
    businessContextLoading,
    scheduleProfessional,
    availabilityPending,
    availabilityGuidance,
    shareOnboardingRequested,
    returnServiceId,
    backTo,
    preserveScheduleOnBack,
    hasChanges,
    showActivationNextStep,
    discardPendingOperations,
    leadTimeBookingOptions,
    updateDay,
    toggleDay,
    setPauseMode,
    copyDayToActiveDays,
    submit
  } = useScheduleEditor({ contextoAgenda, targetProfessionalId });

  if (!config) return (
    <SetupFlowFrame backTo={backTo} enabled={!professionalContext && !ownerTeamSchedule && (shareOnboardingRequested || returnServiceId || location.state?.onboarding === true)} exitTo="/painel" step={4} wide>
      <main className="workspace-page">
        {error ? <ErrorState message={error} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} /> : <LoadingState>Carregando horários...</LoadingState>}
      </main>
    </SetupFlowFrame>
  );

  const firstConfiguration =
    config.origemHorarios !== "personalizado" &&
    !professionalContext &&
    !ownerTeamSchedule;
  const firstProfessionalConfiguration =
    config.origemHorarios !== "personalizado" &&
    (
      professionalContext ||
      ownerTeamSchedule
    );
  // O PUT já personaliza a configuração antes de a próxima missão ser lida.
  // Manter a superfície estável durante essa leitura e a correção de disponibilidade.
  const setupFlow = !professionalContext && !ownerTeamSchedule && (
    firstConfiguration || Boolean(returnServiceId) || shareOnboardingRequested || (setupSessionRef.current && (saving || availabilityPending))
  );
  const SettingsContainer = setupFlow ? "section" : "details";

  return (
    <SetupFlowFrame backDisabled={saving || availabilityPending} backTo={setupFlow ? backTo : undefined} onBack={preserveScheduleOnBack} enabled={setupFlow} exitTo="/painel" step={4} complete={showActivationNextStep && Boolean(businessContext)} wide={!showActivationNextStep}>
    <main className={`workspace-page schedule-settings-page${!showActivationNextStep ? " schedule-editor-page" : ""}`}>
      <UnsavedChangesGuard when={hasChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} preserveOnNavigateTo={setupFlow && !saving && returnServiceId ? backTo : undefined} />
      <header className="workspace-heading">
        <div>
          <SetupTitle emoji={setupFlow ? showActivationNextStep && businessContext ? "🎉" : "📅" : undefined} id="schedule-page-title">{showActivationNextStep
            ? businessContext ? "Seu link está pronto" : "Horários salvos"
            : "Horários de atendimento"}</SetupTitle>
          {!showActivationNextStep && (setupFlow
            ? <p className="setup-step-benefit"><span aria-hidden="true">💬</span><span>Seus horários organizados ajudam suas clientes a escolher quando agendar.</span></p>
            : <p>Defina os dias, horários e pausas.</p>)}
          {ownerTeamSchedule && <p className="muted">Configurando a disponibilidade de <strong>{scheduleProfessional?.nome || "uma profissional da equipe"}</strong>.</p>}
        </div>
      </header>

      {showActivationNextStep ? (
        <section
          aria-label="Divulgação do perfil"
          aria-live="polite"
          className="panel onboarding-panel is-complete schedule-publish-panel"
        >
          <div className="onboarding-complete-copy">
            <p className="schedule-publish-status" role="status">
              <ConfirmationIcon className="schedule-save-icon" />
              <span>{businessContext ? "Perfil publicado. Horários salvos." : "Horários salvos. Não foi possível carregar o link agora."}</span>
            </p>
            {businessContext && <>
              <p>Compartilhe seu link. Seu próximo agendamento começa aqui.</p>
              <label className="setup-public-link">
                Link de agendamento
                <input onFocus={(event) => event.target.select()} readOnly value={buildPublicLink({ businessSlug: businessContext.slug })} />
              </label>
            </>}
          </div>

          <div className="onboarding-complete-actions schedule-publish-actions">
            {businessContextLoading && (
              <span className="muted" role="status">Preparando seu link...</span>
            )}

            {!businessContextLoading && businessContext && (
              <>
                <PublicShareButton
                  businessId={businessContext.id}
                  businessName={businessContext.name}
                  businessSlug={businessContext.slug}
                  className="button"
                  label="Compartilhar link"
                  trackingMission="disponibilizar_horarios"
                  trackingPage="configuracao_agenda"
                />
                <PublicShareButton
                  businessId={businessContext.id}
                  businessName={businessContext.name}
                  businessSlug={businessContext.slug}
                  className="button button-secondary"
                  label="Copiar link"
                  mode="copy"
                  trackingMission="disponibilizar_horarios"
                  trackingPage="configuracao_agenda"
                />
                <Link
                  className="text-button"
                  to={`/negocio/${encodeURIComponent(businessContext.slug)}`}
                >
                  Ver perfil público <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}

            {!businessContextLoading && (
              <Link className={businessContext ? "text-button setup-finish-link" : "button"} to="/painel">
                Ir para o painel
              </Link>
            )}
          </div>
        </section>
      ) : (
        <form aria-busy={saving} className="panel stack-form schedule-settings-form" onSubmit={submit}>
              <section className="schedule-week-section" aria-labelledby={setupFlow ? "schedule-page-title" : "schedule-week-title"}>
                {!setupFlow && <div className="schedule-week-heading">
                  <div>
                    <h2 id="schedule-week-title">Dias de atendimento</h2>
                    <p className="muted">
                      {firstConfiguration || firstProfessionalConfiguration
                        ? professionalContext
                          ? "Revise os dias, horários e pausas em que atende neste negócio. Você poderá editar depois."
                          : ownerTeamSchedule
                            ? "Ajuste os dias, horários e pausas desta profissional. A política de cancelamento pertence ao negócio."
                            : "Ajuste os dias, horários e pausas. Salve para continuar."
                        : "Ative os dias de trabalho e ajuste atendimento e pausa."}
                    </p>
                  </div>
                </div>}

                <div className="schedule-list" aria-label="Semana">
                  <div className="schedule-column-headings" aria-hidden="true">
                    <span>Dia</span>
                    <span>Atendimento</span>
                    <span>Pausa</span>
                    <span>Ação</span>
                  </div>
                  {days.map((day, index) => {
                    const pauseExpanded = expandedPauses.has(day.diaSemana);
                    const dayName = DAY_NAMES[day.diaSemana];
                    return (
                      <article className={day.trabalha ? "schedule-row" : "schedule-row disabled"} key={day.diaSemana}>
                        <label className="day-toggle">
                          <input checked={day.trabalha} disabled={saving} onChange={(e) => toggleDay(index, e.target.checked)} type="checkbox" />
                          <span className="schedule-day-name">
                            <strong>{dayName}</strong>
                            {!setupFlow && <small>{day.trabalha ? "Aberto" : "Fechado"}</small>}
                          </span>
                        </label>

                        {day.trabalha ? (
                          <>
                            <div className="schedule-field-group schedule-attendance-group">
                              <span className="schedule-mobile-label">Atendimento</span>
                              <div className="schedule-time-range">
                                <input
                                  aria-label={`Início do atendimento de ${dayName}`}
                                  disabled={saving}
                                  onChange={(e) => updateDay(index, "horaInicio", e.target.value)}
                                  type="time"
                                  value={day.horaInicio}
                                />
                                <span aria-hidden="true">→</span>
                                <input
                                  aria-label={`Fim do atendimento de ${dayName}`}
                                  disabled={saving}
                                  onChange={(e) => updateDay(index, "horaFim", e.target.value)}
                                  type="time"
                                  value={day.horaFim}
                                />
                              </div>
                            </div>

                            <div className="schedule-field-group schedule-pause-group">
                              <span className="schedule-mobile-label">Pausa</span>
                              <select
                                disabled={saving}
                                aria-label={`Pausa de ${dayName}`}
                                className="schedule-pause-select"
                                onChange={(e) => setPauseMode(day, index, e.target.value === "custom")}
                                value={pauseExpanded ? "custom" : "none"}
                              >
                                <option value="none">Sem pausa</option>
                                <option value="custom">Com pausa</option>
                              </select>
                              {pauseExpanded && (
                                <div className="schedule-time-range schedule-pause-times">
                                  <input
                                    aria-label={`Início da pausa de ${dayName}`}
                                    disabled={saving}
                                    onChange={(e) => updateDay(index, "intervaloInicio", e.target.value)}
                                    type="time"
                                    value={day.intervaloInicio}
                                  />
                                  <span aria-hidden="true">→</span>
                                  <input
                                    aria-label={`Fim da pausa de ${dayName}`}
                                    disabled={saving}
                                    onChange={(e) => updateDay(index, "intervaloFim", e.target.value)}
                                    type="time"
                                    value={day.intervaloFim}
                                  />
                                </div>
                              )}
                            </div>

                            <button
                              disabled={saving}
                              aria-label={`Copiar horário de ${dayName} para os dias ativos`}
                              className="text-button schedule-copy-button"
                              onClick={() => copyDayToActiveDays(index)}
                              title="Copiar este horário para os dias ativos"
                              type="button"
                            >
                              <CopyIcon className="schedule-copy-icon" />
                              <span>Copiar</span>
                            </button>
                          </>
                        ) : (
                          <div className="schedule-closed-state">
                            <span>Este dia não será oferecido para agendamento.</span>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <SettingsContainer
                className="schedule-advanced-settings"
                {...(!setupFlow ? { open: advancedOpen, onToggle: (event) => setAdvancedOpen(event.currentTarget.open) } : {})}
              >
                {setupFlow ? <h2><span aria-hidden="true">⚙️ </span>Regras de agendamento</h2> : <summary>Ajustes avançados</summary>}
                <section className="settings-grid schedule-general-settings" aria-label="Configurações gerais da agenda">
                  <label>
                    {setupFlow && <span aria-hidden="true">⏱️ </span>}Duração padrão
                    <select disabled={saving} onChange={(e) => setConfig({ ...config, duracaoPadrao: Number(e.target.value) })} value={config.duracaoPadrao}>
                      {withCurrentOption(DURATION_OPTIONS, config.duracaoPadrao).map((value) => <option key={value} value={value}>{value} minutos</option>)}
                    </select>
                  </label>
                  <label>
                    {setupFlow && <span aria-hidden="true">☕ </span>}Intervalo entre clientes
                    <select disabled={saving} onChange={(e) => setConfig({ ...config, intervaloMinutos: Number(e.target.value) })} value={config.intervaloMinutos}>
                      {withCurrentOption(INTERVAL_OPTIONS, config.intervaloMinutos).map((value) => (
                        <option key={value} value={value}>{value === 0 ? "Sem intervalo" : `${value} minutos`}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {setupFlow && <span aria-hidden="true">📆 </span>}Antecedência para agendar
                    <select disabled={saving} onChange={(e) => setConfig({ ...config, antecedenciaAgendamento: Number(e.target.value) })} value={config.antecedenciaAgendamento}>
                      {leadTimeBookingOptions.map((value) => <option key={value} value={value}>{formatLeadTime(value)}</option>)}
                    </select>
                  </label>
                  {!professionalContext && !ownerTeamSchedule && (
                    <label>
                      {setupFlow && <span aria-hidden="true">🕒 </span>}Antecedência para cancelar
                      <input
                        disabled={saving}
                        aria-label="Antecedência para cancelar"
                        inputMode="numeric"
                        max="168"
                        min="0"
                        onChange={(e) => setConfig({
                          ...config,
                          antecedenciaCancelamento:
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                        })}
                        step="1"
                        type="number"
                        value={config.antecedenciaCancelamento}
                      />
                      <small className="muted">
                        De 0 a 168 horas. O padrão do AF é 2 horas.
                      </small>
                    </label>
                  )}
                </section>
              </SettingsContainer>

              {availabilityPending && (
                <p
                  className="muted"
                  role="status"
                >
                  {availabilityGuidance?.mensagem || "Seu perfil está publicado, mas ainda não há disponibilidade para novas reservas. Revise os dias e horários antes de divulgar."}
                  {availabilityGuidance?.acao?.destino === "/painel/profissionais" && (
                    <> <Link to="/painel/profissionais">{availabilityGuidance.acao.rotulo || "Abrir equipe"}</Link></>
                  )}
                </p>
              )}
              {error && <p className="form-error schedule-settings-error" role="alert">{error}</p>}
              <div className="form-actions schedule-save-bar">
                <div className="schedule-save-feedback" aria-live="polite">
                  {message && (
                    <span className="schedule-save-status" role="status">
                      <ConfirmationIcon className="schedule-save-icon" />
                      {message}
                    </span>
                  )}
                </div>
                <button
                  className="button"
                  data-source={firstConfiguration ? "ajuste_manual" : "editor"}
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? "Salvando..."
                    : setupFlow
                      ? "Salvar horários e continuar"
                      : "Salvar horários"}
                </button>
              </div>
        </form>
      )}
    </main>
    </SetupFlowFrame>
  );
}
