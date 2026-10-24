import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { PlanUpgradeOpportunity } from "../components/PlanUpgradeOpportunity";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";

export function ProfessionalsPage() {
  const session = useSession();
  const removeDialogRef = useRef(null);
  const inactivateDialogRef = useRef(null);
  const teamReadRef = useRef(null);
  const teamWriteRef = useRef(null);
  const teamReadyRef = useRef(false);
  const servicesDialogRef = useRef(null);
  const servicesReadRef = useRef(null);
  const servicesSaveRef = useRef(null);
  const [items, setItems] = useState(null);
  const [invite, setInvite] = useState("");
  const [lastInvite, setLastInvite] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [teamUpdating, setTeamUpdating] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [pendingInactivate, setPendingInactivate] = useState(null);
  const [inactivateError, setInactivateError] = useState("");
  const saving = Boolean(teamUpdating);
  const [removeError, setRemoveError] = useState("");
  const [servicesTarget, setServicesTarget] = useState(null);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesReady, setServicesReady] = useState(false);
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const activatingId = teamUpdating.startsWith("ativar-") ? teamUpdating.slice(7) : null;
  const [upgradeContextual, setUpgradeContextual] = useState(null);

  const load = useCallback(async () => {
    teamReadRef.current?.controller.abort();
    const context = { controller: new AbortController() };
    teamReadRef.current = context;
    teamReadyRef.current = false;
    const isCurrent = () => teamReadRef.current === context
      && !context.controller.signal.aborted;
    setRefreshing(true);
    setError("");
    setUpgradeContextual(null);
    try {
      const result = await apiRequest("/profissionais", { signal: context.controller.signal });
      if (!isCurrent()) return false;
      const professionals = result.profissionais || [];
      setItems(professionals);
      setReadFailed(false);
      teamReadyRef.current = true;
      const blockedByPlan = professionals.some((professional) => professional.ativo === false
        && ["aguardando_vaga_plano", "excedente_limite_plano"].includes(professional.motivo_inatividade));
      if (blockedByPlan) {
        // A consulta auxiliar não mantém as ações da equipe bloqueadas.
        void apiRequest("/minha-assinatura", { signal: context.controller.signal })
          .then((subscription) => {
            if (isCurrent()) setUpgradeContextual(subscription?.upgrade_contextual || null);
          }).catch(() => {
            if (isCurrent()) setUpgradeContextual(null);
          });
      }
      return true;
    } catch (requestError) {
      if (isCurrent()) {
        setReadFailed(true);
        setError(requestError.message);
      }
      return false;
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      teamReadRef.current?.controller.abort();
      teamReadRef.current = null;
      teamWriteRef.current = null;
      teamReadyRef.current = false;
      servicesReadRef.current?.controller.abort();
      servicesReadRef.current = null;
      servicesSaveRef.current = null;
    };
  }, [load]);

  async function mutateTeam({ key, path, options, applyResult, onSuccess, onUncertain,
    onError = setError, refresh = true }) {
    if (!teamReadyRef.current || teamWriteRef.current || servicesSaveRef.current) return;
    const context = {};
    teamWriteRef.current = context;
    teamReadyRef.current = false;
    teamReadRef.current?.controller.abort();
    teamReadRef.current = null;
    setUpgradeContextual(null);
    setTeamUpdating(key);
    setError("");
    setMessage("");
    const isCurrent = () => teamWriteRef.current === context;
    try {
      const result = await apiRequest(path, options);
      if (!isCurrent()) return;
      applyResult?.(result);
      onSuccess?.(result);
      setMessage(result.mensagem || "Equipe atualizada.");
      if (refresh) {
        const loaded = await load();
        if (!isCurrent()) return;
        if (!loaded) setError("Alteração salva. Não foi possível atualizar a equipe. Atualize a lista para continuar.");
      } else teamReadyRef.current = true;
    } catch (requestError) {
      if (!isCurrent()) return;
      const uncertain = !requestError.status || requestError.status >= 500 || requestError.status === 408;
      if (uncertain) {
        setReadFailed(true);
        onUncertain?.();
        setError("Não foi possível confirmar a alteração. Atualize a equipe antes de tentar novamente.");
      } else {
        teamReadyRef.current = true;
        onError(requestError.message);
      }
    } finally {
      if (isCurrent()) {
        teamWriteRef.current = null;
        setTeamUpdating("");
      }
    }
  }

  function closeServices() {
    servicesReadRef.current?.controller.abort();
    servicesReadRef.current = null;
    servicesDialogRef.current?.close();
    setServicesTarget(null);
    setServiceOptions([]);
    setServicesError("");
    setServicesLoading(false);
    setServicesReady(false);
    setServicesSaving(false);
  }

  async function sendInvite(event) {
    event.preventDefault();
    if (!teamReadyRef.current || teamWriteRef.current || servicesSaveRef.current) return;
    setLastInvite(null);
    return mutateTeam({
      key: "convite", path: "/profissionais/convites",
      options: { method: "POST", body: { emailOuWhatsapp: invite.trim() } },
      refresh: false,
      onSuccess: (result) => {
        setLastInvite(result.convite || null);
        setInvite("");
      },
    });
  }

  function reconcileProfessional(professionalId, result) {
    setItems((current) => current?.map((professional) =>
      Number(professional.id) === Number(result.profissional_id || professionalId)
        ? { ...professional, ativo: result.ativo, motivo_inatividade: result.motivo_inatividade || null }
        : professional));
  }

  async function activateProfessional(professionalId) {
    return mutateTeam({
      key: `ativar-${professionalId}`,
      path: `/profissionais/${professionalId}/ativar`, options: { method: "POST" },
      applyResult: (result) => reconcileProfessional(professionalId, result),
    });
  }

  function closeInactivate() {
    inactivateDialogRef.current?.close();
    setPendingInactivate(null);
    setInactivateError("");
  }

  async function inactivateProfessional() {
    if (!pendingInactivate) return;
    const professionalId = pendingInactivate.id;
    setInactivateError("");
    return mutateTeam({
      key: `inativar-${professionalId}`,
      path: `/profissionais/${professionalId}/inativar`, options: { method: "POST" },
      applyResult: (result) => reconcileProfessional(professionalId, result),
      onSuccess: closeInactivate, onUncertain: closeInactivate, onError: setInactivateError,
    });
  }

  function closeRemove() {
    removeDialogRef.current?.close();
    setPendingRemove(null);
    setRemoveError("");
  }

  async function remove() {
    if (!pendingRemove) return;
    const professionalId = pendingRemove.id;
    setRemoveError("");
    return mutateTeam({
      key: `remover-${professionalId}`, path: `/profissionais/${professionalId}`,
      options: { method: "DELETE" },
      applyResult: () => setItems((current) => current?.filter((item) => item.id !== professionalId)),
      onSuccess: closeRemove, onUncertain: closeRemove, onError: setRemoveError,
    });
  }

  async function openServices(professional) {
    if (servicesSaveRef.current || teamWriteRef.current || !teamReadyRef.current) return;
    servicesReadRef.current?.controller.abort();
    const context = {
      controller: new AbortController(),
      professionalId: Number(professional.id),
      ready: false,
    };
    servicesReadRef.current = context;
    const isCurrent = () => servicesReadRef.current === context
      && !context.controller.signal.aborted;
    setServicesTarget(professional);
    setServiceOptions([]);
    setServicesError("");
    setServicesLoading(true);
    setServicesReady(false);
    servicesDialogRef.current?.showModal();

    try {
      const result = await apiRequest(
        `/profissionais/${professional.id}/servicos`,
        { signal: context.controller.signal }
      );
      if (!isCurrent()) return;
      context.ready = true;
      setServicesReady(true);
      setServiceOptions(result.servicos || []);
    } catch (requestError) {
      if (isCurrent()) setServicesError(requestError.message);
    } finally {
      if (isCurrent()) setServicesLoading(false);
    }
  }

  function toggleService(serviceId) {
    setServiceOptions((current) =>
      current.map((service) =>
        Number(service.id) === Number(serviceId)
          ? {
              ...service,
              habilitado: !service.habilitado
            }
          : service
      )
    );
  }

  async function saveServices() {
    const context = servicesReadRef.current;
    if (!servicesTarget || !context?.ready || servicesLoading
      || context.professionalId !== Number(servicesTarget.id)
      || servicesSaveRef.current || teamWriteRef.current || !teamReadyRef.current) return;
    servicesSaveRef.current = context;
    const isCurrent = () => servicesReadRef.current === context
      && !context.controller.signal.aborted;

    setServicesSaving(true);
    setServicesError("");

    try {
      const enabledIds = serviceOptions
        .filter((service) => service.habilitado)
        .map((service) => Number(service.id));

      const result = await apiRequest(
        `/profissionais/${context.professionalId}/servicos`,
        {
          method: "PUT",
          body: {
            servico_ids: enabledIds
          }
        }
      );

      if (!isCurrent()) return;

      setMessage(
        result.mensagem ||
        "Serviços da profissional atualizados."
      );
      closeServices();
    } catch (requestError) {
      if (isCurrent()) setServicesError(requestError.message);
    } finally {
      if (servicesSaveRef.current === context) {
        servicesSaveRef.current = null;
        if (isCurrent()) setServicesSaving(false);
      }
    }
  }

  const actionsDisabled = saving || refreshing || readFailed || !items || servicesSaving;

  const blockedByPlanCount = (items || []).filter(
    (professional) =>
      professional.ativo === false &&
      [
        "aguardando_vaga_plano",
        "excedente_limite_plano"
      ].includes(professional.motivo_inatividade)
  ).length;

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Sua equipe</p>
          <h1>Profissionais</h1>
          <p>
            Convide quem atende no negócio. A profissional só entra na equipe
            depois de aceitar o convite na própria conta.
          </p>
        </div>
      </header>

      <form className="panel inline-form" onSubmit={sendInvite}>
        <label>
          E-mail ou WhatsApp da profissional
          <input
            autoComplete="off"
            onChange={(event) => setInvite(event.target.value)}
            placeholder="Ela precisa já ter uma conta no AF"
            required
            value={invite}
          />
          <small className="muted">
            O AF usa esse dado apenas para localizar a conta. O outro contato
            da profissional não é exibido.
          </small>
        </label>

        <button className="button" disabled={actionsDisabled} type="submit">
          {teamUpdating === "convite" ? "Enviando convite..." : "Enviar convite"}
        </button>
      </form>

      {error && items && (
        <p className="form-error" role="alert">{error}</p>
      )}

      {items && readFailed && (
        <button className="button button-secondary" disabled={saving || refreshing}
          onClick={() => void load()} type="button">
          {refreshing ? "Atualizando equipe..." : "Atualizar equipe"}
        </button>
      )}

      {message && (
        <p className="form-success" role="status">{message}</p>
      )}

      {lastInvite?.profissional && (
        <section
          aria-label="Convite enviado"
          className="panel invite-sent-card"
        >
          <div>
            <p className="eyebrow">Convite pendente</p>
            <strong>{lastInvite.profissional.nome}</strong>
            <p className="muted">
              O vínculo ainda não foi criado. Você verá essa profissional na
              equipe somente depois do aceite.
            </p>
          </div>
          <span className="invite-status-badge">Aguardando aceite</span>
        </section>
      )}

      {blockedByPlanCount > 0 && (
        <PlanUpgradeOpportunity
          upgrade={upgradeContextual}
          source="profissionais_limite"
          trigger="profissionais_aguardando_vaga"
          trackingPage="profissionais"
          title={blockedByPlanCount === 1
            ? "1 profissional aguarda uma vaga no plano"
            : `${blockedByPlanCount} profissionais aguardam vagas no plano`}
          description="O próximo plano amplia a capacidade da equipe. A ativação continua dependendo da confirmação do pagamento."
        />
      )}

      {!items && !error && (
        <LoadingState>Carregando equipe...</LoadingState>
      )}

      {!items && error && (
        <ErrorState message={error} onRetry={() => void load()} />
      )}

      {items?.length === 0 && (
        <EmptyState title="Nenhuma profissional na equipe">
          Envie um convite para uma conta existente. O vínculo será criado
          somente após o aceite.
        </EmptyState>
      )}

      {items?.length > 0 && (
        <section className="management-grid">
          {items.map((professional) => {
            const owner =
              Number(professional.id) === Number(session.usuario.id);
            const waitingForCapacity =
              professional.ativo === false &&
              professional.motivo_inatividade ===
                "aguardando_vaga_plano";
            const inactiveByDowngrade =
              professional.ativo === false &&
              professional.motivo_inatividade ===
                "excedente_limite_plano";
            const manuallyInactive = professional.ativo === false
              && professional.motivo_inatividade === "inativado_pela_dona";
            const canActivate = waitingForCapacity || inactiveByDowngrade || manuallyInactive;

            return (
              <article
                className="management-card professional-card"
                key={professional.id}
              >
                <MediaThumb
                  alt={`Foto de ${professional.nome}`}
                  className="account-avatar"
                  emoji={String(professional.nome || "P").slice(0, 1)}
                  src={professional.foto_url}
                />

                <div>
                  <h2>{professional.nome}</h2>
                  <p className="muted">
                    {owner
                      ? "Dona do negócio"
                      : waitingForCapacity
                        ? "Aceitou o convite · aguardando vaga no plano"
                        : inactiveByDowngrade
                          ? "Inativa · excedente do limite do plano"
                          : manuallyInactive
                            ? "Inativa por escolha da dona"
                            : "Profissional"}
                  </p>
                </div>

                <div className="professional-card-actions">
                  {canActivate ? (
                    <>
                      <button
                        className="button button-small"
                        disabled={actionsDisabled}
                        onClick={() =>
                          void activateProfessional(professional.id)
                        }
                        type="button"
                      >
                        {Number(activatingId) === Number(professional.id)
                          ? "Ativando..."
                          : "Ativar profissional"}
                      </button>
                    </>
                  ) : professional.ativo !== false ? (
                    <>
                      <button
                        className="text-button"
                        disabled={actionsDisabled}
                        onClick={() => void openServices(professional)}
                        type="button"
                      >
                        Configurar serviços
                      </button>

                      {!owner && (
                        <Link
                          className="text-button"
                          to={`/painel/horarios?profissional=${encodeURIComponent(professional.id)}`}
                        >
                          Configurar horários
                        </Link>
                      )}
                    </>
                  ) : null}

                  {!owner && professional.ativo !== false && (
                    <button className="text-button" disabled={actionsDisabled}
                      onClick={() => {
                        setInactivateError("");
                        setPendingInactivate(professional);
                        inactivateDialogRef.current?.showModal();
                      }} type="button">
                      Inativar profissional
                    </button>
                  )}

                  {!owner && (
                    <button
                      className="text-button danger-text"
                      disabled={actionsDisabled}
                      onClick={() => {
                        setRemoveError("");
                        setPendingRemove(professional);
                        removeDialogRef.current?.showModal();
                      }}
                      type="button"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <dialog
        aria-labelledby="professional-services-title"
        className="cancel-dialog"
        onCancel={(event) => {
          if (servicesSaving) {
            event.preventDefault();
            return;
          }

          closeServices();
        }}
        ref={servicesDialogRef}
      >
        <div className="cancel-dialog-content">
          <div>
            <p className="eyebrow">Serviços da equipe</p>
            <h2 id="professional-services-title">
              {servicesTarget
                ? `O que ${servicesTarget.nome} atende?`
                : "Configurar serviços"}
            </h2>
            <p className="muted">
              Apenas serviços marcados podem aparecer para esta profissional
              em novos agendamentos e transferências.
            </p>
          </div>

          {servicesLoading && (
            <LoadingState>Carregando serviços...</LoadingState>
          )}

          {servicesError && (
            <p className="form-error" role="alert">{servicesError}</p>
          )}

          {!servicesLoading && !servicesError && serviceOptions.length === 0 && (
            <EmptyState title="Nenhum serviço cadastrado">
              Cadastre um serviço antes de configurar a equipe.
            </EmptyState>
          )}

          {!servicesLoading && serviceOptions.length > 0 && (
            <div className="stack-form">
              {serviceOptions.map((service) => (
                <label className="switch-field" key={service.id}>
                  <input
                    checked={service.habilitado === true}
                    disabled={servicesSaving || service.ativo === false}
                    onChange={() => toggleService(service.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{service.nome}</strong>
                    <small>
                      {service.ativo === false
                        ? "Serviço inativo no catálogo"
                        : service.habilitado
                          ? "Habilitada para novos agendamentos"
                          : "Não oferecido por esta profissional"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="cancel-dialog-actions">
            <button
              className="button button-secondary"
              disabled={servicesSaving}
              onClick={closeServices}
              type="button"
            >
              Fechar
            </button>

            <button
              className="button"
              disabled={
                servicesSaving ||
                servicesLoading ||
                !servicesReady
              }
              onClick={() => void saveServices()}
              type="button"
            >
              {servicesSaving ? "Salvando..." : "Salvar serviços"}
            </button>
          </div>
        </div>
      </dialog>

      <dialog aria-labelledby="inactivate-professional-title" className="cancel-dialog"
        ref={inactivateDialogRef} onCancel={(event) => {
          if (saving) event.preventDefault();
          else closeInactivate();
        }}>
        <div className="cancel-dialog-content">
          <h2 id="inactivate-professional-title">Inativar profissional?</h2>
          <p>{pendingInactivate?.nome || "Esta profissional"} deixará de receber novos agendamentos e não ocupará uma vaga no plano.</p>
          <p>As reservas e o histórico serão preservados. Ela poderá consultar as próprias reservas existentes e registrar realizado ou falta no horário permitido. Cancelamentos e reagendamentos ficam com você enquanto ela estiver inativa.</p>
          <p className="muted">Você poderá reativá-la quando houver vaga no plano e ela não estiver ativa em outro negócio.</p>
          {inactivateError && <p className="form-error" role="alert">{inactivateError}</p>}
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" disabled={saving}
              onClick={closeInactivate} type="button">Manter ativa</button>
            <button className="button button-danger" disabled={saving}
              onClick={() => void inactivateProfessional()} type="button">
              {saving ? "Inativando..." : "Sim, inativar"}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        aria-labelledby="remove-professional-title"
        className="cancel-dialog"
        onCancel={(event) => {
          if (saving) event.preventDefault();
          else setPendingRemove(null);
        }}
        ref={removeDialogRef}
      >
        <div className="cancel-dialog-content">
          <div aria-hidden="true" className="cancel-dialog-icon">!</div>

          <h2 id="remove-professional-title">Remover da equipe?</h2>

          <p>
            {pendingRemove?.ativo === false
              ? (
                `O vínculo de ${pendingRemove?.nome || "esta profissional"} será removido. A conta pessoal continuará existindo.`
              )
              : (
                `${pendingRemove?.nome || "Esta profissional"} perderá o acesso a este negócio. A conta pessoal continuará existindo.`
              )}
          </p>

          <p className="muted">
            A remoção só é permitida depois de concluir, cancelar ou registrar falta
            em todos os agendamentos pendentes dessa profissional neste negócio,
            inclusive os de dias anteriores.
          </p>

          {removeError && (
            <p className="form-error" role="alert">{removeError}</p>
          )}

          <div className="cancel-dialog-actions">
            <button
              className="button button-secondary"
              disabled={saving}
              onClick={() => {
                setRemoveError("");
                removeDialogRef.current?.close();
                setPendingRemove(null);
              }}
              type="button"
            >
              Manter profissional
            </button>

            <button
              className="button button-danger"
              disabled={saving}
              onClick={remove}
              type="button"
            >
              {saving ? "Removendo..." : "Sim, remover"}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
