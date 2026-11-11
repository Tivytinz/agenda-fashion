import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { PlanUpgradeOpportunity } from "../components/PlanUpgradeOpportunity";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCurrency } from "../utils/format";
import { categoryLabel, extractServices, uncertainWrite } from "../utils/serviceCatalog";

export function ServicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const removeDialogRef = useRef(null);
  const [services, setServices] = useState(null);
  const [serviceUsage, setServiceUsage] = useState(null);
  const [upgradeContextual, setUpgradeContextual] = useState(null);
  const [error, setError] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [message] = useState(() => location.state?.message || "");
  const loadRequestRef = useRef(0);
  const readRef = useRef(null);
  const writeRef = useRef(null);
  const readyRef = useRef(false);
  const actionsDisabled = refreshing || readFailed || removing || Boolean(togglingId);

  const activeCount = services?.filter((service) => service.ativo !== false).length || 0;
  const serviceLimit = serviceUsage?.limite_servicos === null || serviceUsage?.limite_servicos === undefined
    ? null
    : Number(serviceUsage.limite_servicos);
  const atServiceLimit = serviceLimit !== null && activeCount >= serviceLimit;

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    const isCurrent = () => requestId === loadRequestRef.current && !controller.signal.aborted;
    readyRef.current = false;
    setRefreshing(true);
    setError("");
    setUpgradeContextual(null);
    const servicesRequest = apiRequest("/servicos", { signal: controller.signal });
    void apiRequest("/minha-assinatura", { signal: controller.signal })
      .then((result) => {
        if (!isCurrent()) return;
        setServiceUsage(result?.uso || null);
        setUpgradeContextual(result?.upgrade_contextual || null);
      })
      .catch(() => {});
    try {
      const result = await servicesRequest;
      if (!isCurrent()) return;
      setServices(extractServices(result));
      setReadFailed(false);
      readyRef.current = true;
    } catch (requestError) {
      if (isCurrent()) {
        setReadFailed(true);
        setError(requestError.message);
      }
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      loadRequestRef.current += 1;
      readRef.current?.abort();
      writeRef.current = null;
      readyRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (location.state?.message) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  function askRemove(service) {
    if (!readyRef.current || writeRef.current) return;
    setRemoveError("");
    setPendingRemove(service);
    removeDialogRef.current?.showModal();
  }

  async function toggleServiceVisibility(service) {
    if (!readyRef.current || writeRef.current) return;

    const nextActive = service.ativo === false;

    if (nextActive && atServiceLimit) {
      setError(`Seu plano permite até ${serviceLimit} serviço(s) ativo(s). Desative um serviço antes de escolher outro.`);
      return;
    }

    const operation = {};
    writeRef.current = operation;
    readRef.current?.abort();
    loadRequestRef.current += 1;
    setTogglingId(service.id);
    setError("");
    setVisibilityMessage("");

    try {
      const result = await apiRequest(`/servicos/${service.id}/ativo`, {
        method: "PATCH",
        body: { ativo: nextActive }
      });
      if (writeRef.current !== operation) return;
      const updated = result.servico || { ...service, ativo: nextActive };

      setServices((current) => current.map((item) => (
        item.id === service.id
          ? { ...item, ...updated }
          : item
      )));
      setServiceUsage((current) => current
        ? {
            ...current,
            servicos_utilizados: Math.max(
              0,
              activeCount + (nextActive ? 1 : -1)
            )
          }
        : current);
      setVisibilityMessage(
        result.mensagem || (nextActive
          ? "Serviço ativado no perfil."
          : "Serviço ocultado do perfil.")
      );
    } catch (requestError) {
      if (writeRef.current !== operation) return;
      if (uncertainWrite(requestError)) {
        readyRef.current = false;
        setReadFailed(true);
        setError("Não foi possível confirmar a alteração. Atualize os serviços antes de tentar novamente.");
      } else setError(requestError.message);
    } finally {
      if (writeRef.current === operation) {
        writeRef.current = null;
        setTogglingId(null);
      }
    }
  }

  async function remove() {
    if (!pendingRemove || !readyRef.current || writeRef.current) return;
    const operation = {};
    writeRef.current = operation;
    readRef.current?.abort();
    loadRequestRef.current += 1;
    setRemoving(true);
    setRemoveError("");
    try {
      await apiRequest(`/servicos/${pendingRemove.id}`, { method: "DELETE" });
      if (writeRef.current !== operation) return;
      setServices((current) => current.filter((item) => item.id !== pendingRemove.id));
      removeDialogRef.current?.close();
      setPendingRemove(null);
    } catch (requestError) {
      if (writeRef.current !== operation) return;
      if (uncertainWrite(requestError) || Number(requestError.status || requestError.statusCode) === 404) {
        readyRef.current = false;
        setReadFailed(true);
        removeDialogRef.current?.close();
        setPendingRemove(null);
        setError("Não foi possível confirmar a remoção. Atualize os serviços para conferir o resultado.");
      } else setRemoveError(requestError.message);
    } finally {
      if (writeRef.current === operation) {
        writeRef.current = null;
        setRemoving(false);
      }
    }
  }

  return (
    <main className="workspace-page services-management-page">
      <div>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Seu catálogo</p>
            <h1>Serviços</h1>
            <p>Mostre o que você faz, quanto custa e por que a cliente vai amar.</p>
          </div>
          <Link className="button" to="/painel/servicos/novo">Novo serviço</Link>
        </header>
      </div>

      {services && serviceLimit !== null && (
        <section className="service-plan-limit-panel" aria-label="Limite de serviços ativos">
          <div>
            <strong>{activeCount} de {serviceLimit} serviços ativos</strong>
            <span>Seu plano permite até {serviceLimit}. Escolha abaixo quais serviços aparecem no perfil público.</span>
          </div>
          {atServiceLimit && <small>Para trocar, desative um dos ativos e depois ative o serviço desejado.</small>}
        </section>
      )}

      {atServiceLimit && (
        <PlanUpgradeOpportunity
          upgrade={upgradeContextual}
          source="servicos_limite"
          trigger="servicos_limite"
          trackingPage="servicos"
          title="Seu catálogo precisa de mais espaço"
          description="Você atingiu o limite de serviços ativos do plano atual. O próximo plano libera mais serviços sem precisar ocultar os que já funcionam."
        />
      )}

      {error && services && <p className="form-error" role="alert">{error}</p>}
      {services && readFailed && (
        <button className="button button-secondary" disabled={refreshing || removing || Boolean(togglingId)}
          onClick={() => void load()} type="button">{refreshing ? "Atualizando serviços..." : "Atualizar serviços"}</button>
      )}
      {message && <p className="form-success" role="status">{message}</p>}
      {visibilityMessage && <p className="form-success" role="status">{visibilityMessage}</p>}
      {!services && !error && <LoadingState>Carregando serviços...</LoadingState>}
      {!services && error && <ErrorState message={error} onRetry={load} />}
      {services?.length === 0 && (
        <EmptyState
          action={<Link className="button" to="/painel/servicos/novo">Cadastrar primeiro serviço</Link>}
          title="💅 Seu catálogo começa aqui"
        >
          Cadastre seu primeiro serviço para colocar o perfil no ar. O Agenda Fashion já prepara uma sugestão de horários, que você pode ajustar quando quiser. Fotos ajudam a cliente a escolher, mas podem ser adicionadas depois.
        </EmptyState>
      )}
      {services?.length > 0 && (
        <section className="management-grid">
          {services.map((service) => {
            const active = service.ativo !== false;
            const activatingBlocked = !active && atServiceLimit;
            const toggling = togglingId === service.id;

            return (
              <article className="management-card service-management-card" key={service.id}>
                <div className="service-cover">
                  <MediaThumb
                    alt={`Capa do serviço ${service.nome}`}
                    className={`management-service-media service-category-${service.categoria || "outro"}`}
                    emoji="📷"
                    src={service.foto_url}
                  />
                  {!service.foto_url && (
                    <Link
                      className="service-cover-empty-action"
                      to={`/painel/servicos/${service.id}/editar`}
                    >
                      <span aria-hidden="true">＋</span> Adicionar foto
                    </Link>
                  )}
                </div>
                <div className="management-card-body">
                  <span className={active ? "status-badge status-agendado" : "status-badge status-cancelado"}>
                    {active ? "Visível no perfil" : "Inativo"}
                  </span>
                  <h2>{service.nome}</h2>
                  <p className="service-category-label">{categoryLabel(service.categoria)}</p>
                  {service.descricao && <p className="service-description">{service.descricao}</p>}
                  <p>{service.duracao_minutos || 0} min · <strong>{formatCurrency(service.valor)}</strong></p>
                  <button
                    className={`button button-small service-visibility-toggle${active ? " button-secondary" : ""}`}
                    disabled={actionsDisabled || activatingBlocked}
                    onClick={() => toggleServiceVisibility(service)}
                    title={activatingBlocked ? `Desative um dos ${serviceLimit} serviços ativos para liberar esta vaga.` : undefined}
                    type="button"
                  >
                    {toggling ? "Atualizando..." : active ? "Ocultar do perfil" : "Ativar no perfil"}
                  </button>
                  <div className="card-actions">
                    <Link className="button button-secondary button-small" to={`/painel/servicos/${service.id}/editar`}>Editar</Link>
                    <button className="text-button danger-text" disabled={actionsDisabled} onClick={() => askRemove(service)} type="button">Remover</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <dialog
        aria-labelledby="remove-service-title"
        className="cancel-dialog"
        onCancel={(event) => {
          if (removing) event.preventDefault();
          else setPendingRemove(null);
        }}
        ref={removeDialogRef}
      >
        <div className="cancel-dialog-content">
          <div aria-hidden="true" className="cancel-dialog-icon">!</div>
          <h2 id="remove-service-title">Remover serviço?</h2>
          <p>“{pendingRemove?.nome}” deixará de aparecer para novas clientes.</p>
          {removeError && <p className="form-error" role="alert">{removeError}</p>}
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" disabled={removing} onClick={() => { setRemoveError(""); removeDialogRef.current?.close(); setPendingRemove(null); }} type="button">Manter serviço</button>
            <button className="button button-danger" disabled={removing} onClick={remove} type="button">{removing ? "Removendo..." : "Sim, remover"}</button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
