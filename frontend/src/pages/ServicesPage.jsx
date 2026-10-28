import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import { apiRequest } from "../api/client";
import { getBusinessContext, getPlanIntentPath, normalizePlanSlug } from "../auth/session";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { FlowSteps } from "../components/FlowSteps";
import { PlanUpgradeOpportunity } from "../components/PlanUpgradeOpportunity";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCurrency } from "../utils/format";
import { readServiceCreationReference, serviceCreationReferenceHash } from "../utils/serviceCreationReference";

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  categoria: "",
  valor: "",
  duracao_minutos: "60",
  ativo: true,
  foto_url: "",
  foto_public_id: ""
};
const SERVICE_CATEGORIES = [
  ["unha", "Unhas"],
  ["cabelo", "Cabelos"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"],
  ["maquiagem", "Maquiagem"],
  ["estetica", "Estética"],
  ["bronzeamento", "Bronzeamento"],
  ["outro", "Outro"]
];
const categoryLabel = (value) => SERVICE_CATEGORIES.find(([key]) => key === value)?.[1] || "Sem categoria";
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACTIVATION_STEPS = ["Negócio", "Serviço"];

function extractServices(result) {
  return Array.isArray(result) ? result : result?.servicos || [];
}

function uncertainWrite(error) {
  const status = Number(error.status || error.statusCode);
  return !status || status >= 500 || status === 408;
}

function operationKey(prefix) {
  const unique = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

function serviceForm(service, fallback = EMPTY_FORM) {
  return {
    nome: service.nome ?? fallback.nome,
    descricao: service.descricao === undefined ? fallback.descricao : service.descricao || "",
    categoria: service.categoria ?? fallback.categoria,
    valor: String(service.valor ?? fallback.valor),
    duracao_minutos: String(service.duracao_minutos ?? fallback.duracao_minutos),
    ativo: service.ativo === undefined ? fallback.ativo : service.ativo !== false,
    foto_url: service.foto_url === undefined ? fallback.foto_url : service.foto_url || "",
    foto_public_id: service.foto_public_id === undefined ? fallback.foto_public_id : service.foto_public_id || "",
  };
}

function serviceBody(form) {
  return {
    nome: form.nome.trim(), descricao: form.descricao.trim(), categoria: form.categoria,
    valor: Number(form.valor), duracao_minutos: Number(form.duracao_minutos), ativo: form.ativo,
  };
}

function validateImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Cada imagem pode ter no máximo 5 MB.";
  }
  return "";
}

async function uploadImage(path, file, key) {
  const body = new FormData();
  body.append("foto", file);
  return apiRequest(path, { method: "POST", body, ...(key ? { headers: { "Idempotency-Key": key } } : {}) });
}

function samePhoto(photo, fotoUrl, fotoPublicId) {
  if (fotoPublicId && photo?.foto_public_id) {
    return fotoPublicId === photo.foto_public_id;
  }
  return Boolean(fotoUrl && photo?.foto_url && fotoUrl === photo.foto_url);
}

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
                    emoji="✦"
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

export function ServiceEditorPage() {
  const session = useSession();
  const usuarioId = Number(session.usuario?.id) || 0;
  const negocioId = Number(getBusinessContext(session, "dono")?.id) || 0;
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = normalizePlanSlug(searchParams.get("plano"));
  const galleryRef = useRef(null);
  const galleryResourceRef = useRef(id);
  const editorContextRef = useRef(null);
  const operationRef = useRef(null);
  const creationAttemptRef = useRef(null);
  const creationReadRef = useRef(null);
  const uploadAttemptsRef = useRef(new Map());
  const uploadRecoveryRef = useRef(null);
  const mediaRecoveryRef = useRef(null);
  const editing = Boolean(id);
  const firstServiceOnboarding =
    !editing
    && (
      searchParams.get("onboarding") === "servico"
      || (
        location.state?.onboarding === true
        && location.state?.onboardingStep === "servico"
      )
    );
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const [cover, setCover] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [persistedId, setPersistedId] = useState(id || "");
  const [loading, setLoading] = useState(() => editing || Boolean(
    readServiceCreationReference(location.hash, usuarioId, negocioId)
  ));
  const [loadError, setLoadError] = useState("");
  const [recoveryRemoved, setRecoveryRemoved] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [galleryLoading, setGalleryLoading] = useState(editing);
  const [galleryError, setGalleryError] = useState("");
  const [galleryLoadAttempt, setGalleryLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [galleryUncertain, setGalleryUncertain] = useState(false);
  const [mediaUncertain, setMediaUncertain] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState(null);
  const [definingCoverId, setDefiningCoverId] = useState(null);
  const [mediaMessage, setMediaMessage] = useState("");
  const [error, setError] = useState("");
  const fieldsDisabled = saving || creationUncertain || galleryUncertain || mediaUncertain;
  const mediaBusy = fieldsDisabled || Boolean(removingPhotoId) || Boolean(definingCoverId);
  const hasChanges = !loading && (
    JSON.stringify({ ...form, foto_url: "", foto_public_id: "" })
      !== JSON.stringify({ ...savedForm, foto_url: "", foto_public_id: "" })
    || Boolean(cover)
    || galleryFiles.length > 0
  );
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : "", [cover]);
  const galleryItems = useMemo(() => {
    if (!form.foto_url || gallery.some((photo) => samePhoto(photo, form.foto_url, form.foto_public_id))) {
      return gallery;
    }

    return [
      {
        id: "current-cover",
        foto_url: form.foto_url,
        foto_public_id: form.foto_public_id,
        virtualCover: true
      },
      ...gallery
    ];
  }, [form.foto_public_id, form.foto_url, gallery]);

  useEffect(() => {
    const context = { id, usuarioId, negocioId, generation: 0 };
    editorContextRef.current = context;
    operationRef.current = null;
    creationAttemptRef.current = id ? null : readServiceCreationReference(location.hash, usuarioId, negocioId);
    creationReadRef.current?.abort();
    creationReadRef.current = null;
    uploadAttemptsRef.current = new Map();
    uploadRecoveryRef.current?.abort();
    uploadRecoveryRef.current = null;
    mediaRecoveryRef.current = null;
    setCreationUncertain(false);
    setGalleryUncertain(false);
    setMediaUncertain(false);
    setSaving(false);
    setRemovingPhotoId(null);
    setDefiningCoverId(null);

    return () => {
      if (editorContextRef.current === context) editorContextRef.current = null;
      creationReadRef.current?.abort();
      uploadRecoveryRef.current?.abort();
    };
  }, [id, usuarioId, negocioId]);

  function retainCreationReference(key) {
    const hash = serviceCreationReferenceHash(location.hash, key ? { key, usuarioId, negocioId } : null);
    navigate({ pathname: location.pathname, search: location.search, hash }, {
      replace: true, flushSync: true, state: location.state,
    });
  }

  function beginOperation() {
    // O lock vale antes de o React renderizar os controles desabilitados.
    if (operationRef.current || !editorContextRef.current) return null;
    const operation = {
      context: editorContextRef.current,
      generation: editorContextRef.current.generation,
    };
    operationRef.current = operation;
    return operation;
  }

  function isCurrentOperation(operation) {
    return editorContextRef.current === operation.context
      && operation.context.generation === operation.generation;
  }

  function discardPendingOperations() {
    // Suspense pode manter este editor montado enquanto o destino carrega.
    if (editorContextRef.current) editorContextRef.current.generation += 1;
    if (creationReadRef.current) {
      creationReadRef.current.abort();
      creationReadRef.current = null;
      setLoading(false);
      setRecoveryRemoved(false);
      setLoadError("A consulta do cadastro foi interrompida. Tente novamente para recuperar o serviço.");
    }
    uploadRecoveryRef.current?.abort();
    operationRef.current = null;
    setSaving(false);
    setRemovingPhotoId(null);
    setDefiningCoverId(null);
  }

  function finishOperation(operation) {
    if (operationRef.current === operation) operationRef.current = null;
  }

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    if (!mediaMessage) return undefined;
    const timeoutId = window.setTimeout(() => setMediaMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [mediaMessage]);

  useEffect(() => {
    if (!editing) {
      setLoadError("");
      setRecoveryRemoved(false);
      setRecoveryMessage("");
      setForm(EMPTY_FORM);
      setSavedForm(EMPTY_FORM);
      setPersistedId("");
      setCover(null);
      setGalleryFiles([]);
      setError("");
      const attempt = creationAttemptRef.current;
      if (!attempt) {
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      creationReadRef.current = controller;
      const context = editorContextRef.current;
      const generation = context.generation;
      let active = true;
      const isCurrent = () => active && !controller.signal.aborted
        && editorContextRef.current === context && context.generation === generation;
      setLoading(true);
      apiRequest(`/servicos/tentativa?negocio_id=${encodeURIComponent(negocioId)}`, {
        headers: { "Idempotency-Key": attempt.key }, signal: controller.signal,
      }).then((result) => {
        if (!isCurrent()) return;
        if (result.estado === "nao_encontrada") {
          // Um POST antigo ainda pode chegar depois desta leitura. Conservar a
          // chave impede outra criação mesmo se os dados forem preenchidos de novo.
          setCreationUncertain(false);
          setRecoveryMessage("Ainda não há cadastro confirmado para esta tentativa. Preencha os dados para continuar com segurança.");
          return;
        }
        if (!result.servico?.id) throw new Error("Não foi possível recuperar o cadastro. Verifique novamente.");
        const confirmed = serviceForm(result.servico);
        flushSync(() => {
          setForm(confirmed);
          setSavedForm(confirmed);
          setPersistedId(String(result.servico.id));
        });
        if (!isCurrent()) return;
        if (firstServiceOnboarding) continueFirstServiceOnboarding(result);
        else navigate(`/painel/servicos/${encodeURIComponent(result.servico.id)}/editar`, { replace: true });
      }).catch((requestError) => {
        if (!isCurrent()) return;
        setLoadError(requestError.message);
        setRecoveryRemoved(Number(requestError.status) === 410);
      }).finally(() => {
        if (creationReadRef.current === controller) creationReadRef.current = null;
        if (isCurrent()) setLoading(false);
      });
      return () => { active = false; controller.abort(); };
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError("");
    apiRequest("/servicos", { signal: controller.signal })
      .then((servicesResult) => {
        if (!active) return;
        const service = extractServices(servicesResult).find((item) => Number(item.id) === Number(id));
        if (!service) throw new Error("Serviço não encontrado.");
        const loadedForm = serviceForm(service);
        setForm(loadedForm);
        setSavedForm(loadedForm);
        setPersistedId(id);
        setCover(null);
        setGalleryFiles([]);
        setError("");
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [editing, id, usuarioId, negocioId, loadAttempt]);

  useEffect(() => {
    if (galleryResourceRef.current !== id) {
      galleryResourceRef.current = id;
      setGallery([]);
    }
    if (!editing) {
      setGalleryLoading(false);
      setGalleryError("");
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const photosAtRequest = new Set(gallery.map((photo) => photo.id));
    setGalleryLoading(true);
    setGalleryError("");
    apiRequest(`/servicos/${encodeURIComponent(id)}/fotos`, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        const photos = Array.isArray(result) ? result : result?.fotos || [];
        const receivedIds = new Set(photos.map((photo) => photo.id));
        // Um upload pode terminar enquanto esta leitura opcional ainda está pendente.
        setGallery((current) => [
          ...photos,
          ...current.filter((photo) => !photosAtRequest.has(photo.id) && !receivedIds.has(photo.id))
        ]);
      })
      .catch((requestError) => {
        if (active) setGalleryError(requestError.message);
      })
      .finally(() => {
        if (active) setGalleryLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [editing, id, galleryLoadAttempt]);

  function isGalleryCover(photo) {
    return samePhoto(photo, form.foto_url, form.foto_public_id);
  }

  function scrollGallery(direction) {
    const scroller = galleryRef.current;
    if (!scroller) return;
    const distance = Math.max(210, Math.min((scroller.clientWidth || 320) * 0.85, 440));
    scroller.scrollBy?.({ left: direction * distance, behavior: "smooth" });
  }

  function selectCover(event) {
    if (operationRef.current) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setMediaMessage("");
    setCover(file);
    event.target.value = "";
  }

  function selectGallery(event) {
    if (operationRef.current) return;
    const files = Array.from(event.target.files || []);
    const validationError = files.map(validateImage).find(Boolean);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setMediaMessage("");
    setGalleryFiles((current) => {
      const pending = [...current];
      for (const file of files) {
        if (!pending.some((item) => item.name === file.name
          && item.size === file.size
          && item.type === file.type
          && item.lastModified === file.lastModified)) {
          pending.push(file);
        }
      }
      return pending;
    });
    event.target.value = "";
  }

  function continueFirstServiceOnboarding(saveResult) {
    const published = saveResult.publicacao?.publicado === true;

    if (published) {
      // A sessão atual já contém o vínculo e o papel da dona. Atualizar o
      // marcador de publicação é útil, mas não pode bloquear Serviço → Horários
      // em uma falha ou lentidão transitória de /minha-sessao.
      session.refresh({ silent: true }).catch(() => {});
    }

    const destination = !published
      ? getPlanIntentPath("/painel/negocio", selectedPlan)
      : getPlanIntentPath("/painel/horarios", selectedPlan);

    navigate(destination, {
      replace: true,
      state: !published
        ? {
            message: "Serviço cadastrado. Revise os dados obrigatórios do negócio para concluir a publicação.",
            onboarding: true,
            onboardingStep: "perfil"
          }
        : {
            message: "Serviço cadastrado e perfil publicado. Agora confirme ou ajuste os horários sugeridos.",
            onboarding: true,
            onboardingStep: "agenda"
          }
    });
  }

  async function recoverGalleryUploads(operation, signal) {
    let removed = false;
    for (const [file, attempt] of uploadAttemptsRef.current) {
      if (!attempt.uncertain) continue;
      try {
        const result = await apiRequest(`/servicos/${attempt.servicoId}/fotos/tentativa`, {
          headers: { "Idempotency-Key": attempt.key },
          signal,
        });
        if (!isCurrentOperation(operation)) return;
        if (result.estado === "nao_encontrada") {
          // Conservar a chave: o envio original ainda pode concluir depois do GET.
          attempt.uncertain = false;
          continue;
        }
        if (!result.foto?.id) throw new Error("Não foi possível identificar a foto salva.");
        setGallery((current) => [...current.filter((photo) => photo.id !== result.foto.id), result.foto]);
      } catch (failure) {
        if (!isCurrentOperation(operation)) return;
        if (Number(failure.status) !== 410) throw failure;
        removed = true;
      }
      uploadAttemptsRef.current.delete(file);
      setGalleryFiles((current) => current.filter((item) => item !== file));
    }
    if (!isCurrentOperation(operation)) return;
    setGalleryUncertain(false);
    setMediaMessage(removed
      ? "A foto foi removida e não será reenviada. Selecione outra foto para continuar."
      : "Fotos conferidas. Se houver arquivos pendentes, salve para concluir o envio.");
  }

  async function recoverMediaState(operation, signal) {
    const [servicesResult, photosResult] = await Promise.all([
      apiRequest("/servicos", { signal }),
      apiRequest(`/servicos/${persistedId}/fotos`, { signal }),
    ]);
    if (!isCurrentOperation(operation)) return;
    const confirmed = extractServices(servicesResult).find(item => Number(item.id) === Number(persistedId));
    if (!confirmed) throw new Error("Serviço não encontrado. Volte aos serviços para continuar.");
    const photos = Array.isArray(photosResult) ? photosResult : photosResult?.fotos;
    if (!Array.isArray(photos)) throw new Error("Não foi possível confirmar as fotos atuais. Verifique novamente.");
    const patch = { foto_url: confirmed.foto_url || "", foto_public_id: confirmed.foto_public_id || "" };
    if (mediaRecoveryRef.current?.type === "cover" && samePhoto(mediaRecoveryRef.current.photo, patch.foto_url, patch.foto_public_id)) {
      setCover(null);
    }
    // Somente mídia é reconciliada: preço, descrição e demais rascunhos ficam intactos.
    setForm(current => ({ ...current, ...patch }));
    setSavedForm(current => ({ ...current, ...patch }));
    setGallery(photos);
    const pendingUpload = cover && mediaRecoveryRef.current?.type === "upload";
    mediaRecoveryRef.current = null;
    setMediaUncertain(false);
    setMediaMessage(pendingUpload
      ? "Capa atual conferida. Confira a galeria antes de salvar para substituí-la pela imagem selecionada."
      : "Fotos conferidas. Você pode continuar editando.");
  }

  async function submit(event) {
    event.preventDefault();
    if (loading || loadError) return;
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    setError("");
    setMediaMessage("");
    try {
      if (galleryUncertain || mediaUncertain) {
        const controller = new AbortController();
        uploadRecoveryRef.current = controller;
        try {
          if (mediaUncertain) await recoverMediaState(operation, controller.signal);
          else await recoverGalleryUploads(operation, controller.signal);
        }
        catch (failure) {
          if (isCurrentOperation(operation)) setError(`Não foi possível consultar o envio das fotos. ${failure.message}`);
        }
        finally {
          if (uploadRecoveryRef.current === controller) uploadRecoveryRef.current = null;
        }
        return;
      }
      let savedId = persistedId;
      let saveResult;
      try {
        const body = serviceBody(form);
        // Salvar sem alterações não regrava dados já confirmados. Outra
        // aba pode ter pausado ou editado o serviço desde o primeiro salvamento.
        const coreUnchanged = !firstServiceOnboarding && savedId
          && JSON.stringify(body) === JSON.stringify(serviceBody(savedForm));
        if (!savedId) {
          if (!usuarioId || !negocioId) throw Object.assign(new Error("Atualize sua sessão antes de cadastrar o serviço."), { status: 403 });
          if (!creationAttemptRef.current) {
            creationAttemptRef.current = { key: operationKey("servico") };
            retainCreationReference(creationAttemptRef.current.key);
          }
          if (!isCurrentOperation(operation)) return;
          creationAttemptRef.current.body ||= { ...body, negocio_id: negocioId };
        }
        if (!coreUnchanged) {
          saveResult = await apiRequest(savedId ? `/servicos/${savedId}` : "/servicos", {
            method: savedId ? "PUT" : "POST",
            ...(!savedId ? { headers: { "Idempotency-Key": creationAttemptRef.current.key } } : {}),
            body: savedId ? body : creationAttemptRef.current.body,
          });
          if (!isCurrentOperation(operation)) return;
          savedId = saveResult.servico?.id || savedId;
          if (!savedId) {
            throw new Error("O serviço foi salvo, mas não foi possível identificar o cadastro.");
          }
          setPersistedId(String(savedId));
          setCreationUncertain(false);
          creationAttemptRef.current = null;
          const confirmedForm = serviceForm(saveResult.servico || {}, form);
          flushSync(() => {
            setForm(confirmedForm);
            setSavedForm(confirmedForm);
          });
          if (!isCurrentOperation(operation)) return;
        } else {
          // Normalizar também o baseline local, para que diferenças apenas de
          // espaços ou formato numérico não bloqueiem a navegação de sucesso.
          const confirmedForm = serviceForm(body, form);
          flushSync(() => {
            setForm(confirmedForm);
            setSavedForm(confirmedForm);
          });
          if (!isCurrentOperation(operation)) return;
        }
      } catch (requestError) {
        if (isCurrentOperation(operation)) {
          if (!persistedId && requestError.data?.codigo === "SERVICO_TENTATIVA_DIVERGENTE") {
            creationAttemptRef.current = { key: creationAttemptRef.current.key };
            setLoadAttempt((attempt) => attempt + 1);
            return;
          }
          if (!persistedId && Number(requestError.status) === 410) {
            setLoadError(requestError.message);
            setRecoveryRemoved(true);
            return;
          }
          const uncertain = !persistedId && uncertainWrite(requestError);
          setCreationUncertain(uncertain);
          if (!uncertain && !persistedId) {
            creationAttemptRef.current = null;
            retainCreationReference(null);
          }
          setError(uncertain
            ? "Não foi possível confirmar o cadastro. Verifique novamente para recuperar esta tentativa antes de alterar os dados."
            : requestError.message);
        }
        return;
      }

      // A primeira missão não exibe mídia. O serviço salvo já permite continuar.
      if (firstServiceOnboarding) {
        continueFirstServiceOnboarding(saveResult);
        return;
      }

      try {
        if (cover) {
          let uploaded;
          try { uploaded = await uploadImage(`/servicos/${savedId}/foto`, cover); }
          catch (failure) {
            if (isCurrentOperation(operation) && uncertainWrite(failure)) {
              mediaRecoveryRef.current = { type: "upload" };
              setMediaUncertain(true);
            }
            throw failure;
          }
          if (!isCurrentOperation(operation)) return;
          if (uploaded.servico) {
            const coverPatch = {
              foto_url: uploaded.servico.foto_url || "",
              foto_public_id: uploaded.servico.foto_public_id || ""
            };
            setForm((current) => ({ ...current, ...coverPatch }));
            setSavedForm((current) => ({ ...current, ...coverPatch }));
          }
          setCover(null);
        }
        for (const file of galleryFiles) {
          let attempt = uploadAttemptsRef.current.get(file);
          if (!attempt) {
            attempt = { key: operationKey("foto"), servicoId: savedId, uncertain: false };
            uploadAttemptsRef.current.set(file, attempt);
          }
          let uploaded;
          try { uploaded = await uploadImage(`/servicos/${savedId}/fotos`, file, attempt.key); }
          catch (failure) {
            if (!isCurrentOperation(operation)) return;
            if (uncertainWrite(failure)) {
              attempt.uncertain = true;
              setGalleryUncertain(true);
            } else if (Number(failure.status) === 410) {
              uploadAttemptsRef.current.delete(file);
              setGalleryFiles((current) => current.filter((item) => item !== file));
            }
            throw failure;
          }
          if (!isCurrentOperation(operation)) return;
          if (uploaded.foto) {
            setGallery((current) => [...current.filter((photo) => photo.id !== uploaded.foto.id), uploaded.foto]);
          }
          setGalleryFiles((current) => current.filter((item) => item !== file));
          uploadAttemptsRef.current.delete(file);
        }
      } catch (requestError) {
        if (isCurrentOperation(operation)) {
          setError(mediaRecoveryRef.current?.type === "upload"
            ? `O serviço foi salvo, mas não foi possível confirmar o envio da capa. ${requestError.message} Verifique as fotos antes de continuar.`
            : `O serviço foi salvo, mas algumas fotos não foram enviadas. ${requestError.message} Tente novamente para enviar apenas as fotos pendentes.`);
        }
        return;
      }

      flushSync(() => {
        setCover(null);
        setGalleryFiles([]);
      });
      if (!isCurrentOperation(operation)) return;
      navigate("/painel/servicos", {
        replace: true,
        state: {
          message: editing
            ? "Serviço atualizado."
            : "Serviço criado."
        }
      });
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setSaving(false);
      }
    }
  }

  async function chooseGalleryCover(photo) {
    if (!persistedId || mediaBusy || galleryLoading || isGalleryCover(photo) || photo.virtualCover) return;
    const operation = beginOperation();
    if (!operation) return;

    setDefiningCoverId(photo.id);
    setError("");
    setMediaMessage("");

    try {
      const result = await apiRequest(`/servicos/${persistedId}/capa`, {
        method: "PUT",
        body: { foto_id: photo.id }
      });
      if (!isCurrentOperation(operation)) return;
      const service = result.servico || {};
      const coverPatch = {
        foto_url: service.foto_url || photo.foto_url || "",
        foto_public_id: service.foto_public_id || photo.foto_public_id || ""
      };
      setCover(null);
      setForm((current) => ({ ...current, ...coverPatch }));
      setSavedForm((current) => ({ ...current, ...coverPatch }));
      setMediaMessage("Foto escolhida como capa do serviço.");
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        if (uncertainWrite(requestError) || Number(requestError.status || requestError.statusCode) === 404) {
          mediaRecoveryRef.current = { type: "cover", photo };
          setMediaUncertain(true);
        }
        setError(requestError.message);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setDefiningCoverId(null);
      }
    }
  }

  async function removeGalleryPhoto(photo) {
    if (mediaBusy || galleryLoading || photo.virtualCover) return;
    const operation = beginOperation();
    if (!operation) return;
    const wasCover = isGalleryCover(photo);
    setRemovingPhotoId(photo.id);
    setError("");
    setMediaMessage("");
    try {
      const result = await apiRequest(`/servicos/fotos/${photo.id}`, { method: "DELETE" });
      if (!isCurrentOperation(operation)) return;
      setGallery((current) => current.filter((item) => item.id !== photo.id));
      if (wasCover || result.capa_removida) {
        setForm((current) => ({ ...current, foto_url: "", foto_public_id: "" }));
        setSavedForm((current) => ({ ...current, foto_url: "", foto_public_id: "" }));
        setMediaMessage("A foto foi removida. Escolha outra imagem para a capa.");
      } else {
        setMediaMessage("Foto removida da galeria.");
      }
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        if (uncertainWrite(requestError) || Number(requestError.status || requestError.statusCode) === 404) {
          mediaRecoveryRef.current = { type: "remove" };
          setMediaUncertain(true);
        }
        setError(requestError.message);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setRemovingPhotoId(null);
      }
    }
  }

  if (loading) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><LoadingState>Carregando serviço...</LoadingState></main>;
  if (loadError) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><BackLink to="/painel/servicos">Voltar aos serviços</BackLink><ErrorState message={loadError} onRetry={recoveryRemoved ? undefined : () => setLoadAttempt((attempt) => attempt + 1)} /></main>;

  return (
    <main className="workspace-page service-editor-page">
      <UnsavedChangesGuard when={hasChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} />
      <div>
        <BackLink to="/painel/servicos">Voltar aos serviços</BackLink>
        {firstServiceOnboarding && (
          <FlowSteps
            ariaLabel="Etapas para publicar o negócio"
            current={2}
            steps={ACTIVATION_STEPS}
          />
        )}
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h1>{editing ? "Editar serviço" : "Novo serviço"}</h1>
            <p>
              {firstServiceOnboarding
                ? "Informe nome, categoria, valor e duração. Ao salvar, o AF publica o perfil automaticamente quando os dados do negócio estiverem completos. Descrição, fotos e horários podem ser ajustados depois."
                : "Preencha os dados do serviço. Fotos e descrição ajudam a cliente a escolher, mas podem ser melhoradas depois."}
            </p>
          </div>
        </header>
      </div>

      <form aria-busy={saving} className="service-editor-grid" onSubmit={submit}>
        <section className="panel stack-form">
          <div><p className="eyebrow">Informações</p><h2>Detalhes do serviço</h2></div>
          <label>
            Nome do serviço
            <input disabled={fieldsDisabled} minLength="2" onChange={(event) => setForm({ ...form, nome: event.target.value })} required value={form.nome} />
          </label>
          <label>
            Categoria
            <select
              disabled={fieldsDisabled}
              onChange={(event) => setForm({ ...form, categoria: event.target.value })}
              required
              value={form.categoria}
            >
              <option value="">Selecione a categoria</option>
              {SERVICE_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <small>Ajuda a cliente a encontrar este serviço na página inicial.</small>
          </label>
          {!firstServiceOnboarding && (
            <label>
              Descrição
              <textarea
                disabled={fieldsDisabled}
                maxLength="1200"
                onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                placeholder="Explique o resultado, materiais ou diferenciais."
                rows="5"
                value={form.descricao}
              />
              <small>{form.descricao.length}/1200 caracteres</small>
            </label>
          )}
          <div className="form-grid">
            <label>
              Valor
              <input disabled={fieldsDisabled} min="0" onChange={(event) => setForm({ ...form, valor: event.target.value })} required step="0.01" type="number" value={form.valor} />
            </label>
            <label>
              Duração em minutos
              <input disabled={fieldsDisabled} min="5" onChange={(event) => setForm({ ...form, duracao_minutos: event.target.value })} required step="5" type="number" value={form.duracao_minutos} />
            </label>
          </div>
          {!firstServiceOnboarding && (
            <label className="switch-field">
              <input checked={form.ativo} disabled={fieldsDisabled} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} type="checkbox" />
              <span><strong>Serviço disponível</strong><small>Quando inativo, ele não aparece para novos agendamentos.</small></span>
            </label>
          )}
        </section>

        {!firstServiceOnboarding && (
          <section className="panel stack-form service-media-panel">
            <div>
              <p className="eyebrow">Apresentação</p>
              <h2>Fotos do serviço</h2>
              <p className="muted service-media-help">Opcional para publicar. Adicione fotos quando quiser e escolha qual delas aparece como capa no catálogo e no perfil público.</p>
            </div>

            <div className="service-cover-section">
              <div className="service-media-section-heading">
                <strong>Capa do serviço</strong>
                <small>Esta é a primeira imagem que a cliente vê.</small>
              </div>
              <div className="cover-upload">
                <div className="cover-preview">
                  {coverPreview
                    ? <img alt="Prévia da nova capa" src={coverPreview} />
                    : form.foto_url
                      ? <MediaThumb alt={`Capa atual do serviço ${form.nome}`} className="editor-media" emoji="✦" src={form.foto_url} />
                      : <span><strong>✦</strong>Adicione uma foto de capa</span>}
                </div>
                <label className="button button-secondary button-small">
                  {cover ? "Trocar imagem escolhida" : form.foto_url ? "Trocar capa" : "Escolher capa"}
                  <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={mediaBusy} onChange={selectCover} type="file" />
                </label>
              </div>
            </div>

            <div className="service-gallery-upload">
              <div className="service-gallery-upload-copy">
                <strong>Adicionar fotos à galeria</strong>
                <small>JPG, PNG ou WEBP · até 5 MB por foto.</small>
              </div>
              <label className="button button-secondary button-small service-gallery-upload-button">
                <span aria-hidden="true">＋</span> Adicionar fotos
                <input
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Adicionar fotos à galeria"
                  className="sr-only"
                  disabled={mediaBusy}
                  multiple
                  onChange={selectGallery}
                  type="file"
                />
              </label>
            </div>
            {galleryFiles.length > 0 && (
              <p className="upload-selection">{galleryFiles.length} {galleryFiles.length === 1 ? "foto selecionada" : "fotos selecionadas"}.</p>
            )}
            {mediaMessage && <p className="service-media-success" role="status">{mediaMessage}</p>}
            {galleryLoading && <p className="muted" role="status">Carregando fotos...</p>}
            {galleryError && (
              <div className="service-gallery-error">
                <p className="form-error" role="alert">Não foi possível carregar a galeria. {galleryError}</p>
                <button className="button button-secondary button-small" disabled={mediaBusy} onClick={() => setGalleryLoadAttempt((attempt) => attempt + 1)} type="button">
                  Tentar carregar fotos novamente
                </button>
              </div>
            )}
            {galleryItems.length > 0 && (
              <div className="service-gallery-picker-wrap">
                <div className="service-gallery-heading">
                  <div>
                    <strong>Galeria atual</strong>
                    <small>{galleryItems.length} {galleryItems.length === 1 ? "foto" : "fotos"}</small>
                  </div>
                  {galleryItems.length > 1 && (
                    <div className="service-gallery-nav" aria-label="Navegação da galeria">
                      <button aria-label="Fotos anteriores" onClick={() => scrollGallery(-1)} type="button">‹</button>
                      <button aria-label="Próximas fotos" onClick={() => scrollGallery(1)} type="button">›</button>
                    </div>
                  )}
                </div>
                <div className="service-gallery service-gallery-picker" aria-label="Galeria atual" ref={galleryRef}>
                  {galleryItems.map((photo) => {
                    const currentCover = isGalleryCover(photo);
                    const choosing = definingCoverId === photo.id;
                    return (
                      <figure className={currentCover ? "is-cover" : ""} key={photo.id}>
                        <div className="service-gallery-media">
                          <MediaThumb alt={`Foto da galeria de ${form.nome}`} className="editor-media" emoji="✦" src={photo.foto_url} />
                          {!photo.virtualCover && (
                            <button
                              aria-label="Remover foto da galeria"
                              className="service-gallery-remove"
                              disabled={mediaBusy || galleryLoading}
                              onClick={() => removeGalleryPhoto(photo)}
                              title="Remover foto"
                              type="button"
                            >
                              {removingPhotoId === photo.id ? "…" : "×"}
                            </button>
                          )}
                        </div>
                        <figcaption>
                          {currentCover ? (
                            <span className="service-cover-current-label">
                              <ConfirmationIcon className="service-cover-badge-icon" />
                              Capa atual
                            </span>
                          ) : (
                            <button
                              className="service-cover-choice"
                              disabled={mediaBusy || galleryLoading}
                              onClick={() => chooseGalleryCover(photo)}
                              type="button"
                            >
                              {choosing ? "Escolhendo..." : "Usar como capa"}
                            </button>
                          )}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {recoveryMessage && <p className="service-editor-message" role="status">{recoveryMessage}</p>}
        {error && <p className="form-error service-editor-message" role="alert">{error}</p>}
        <div className="form-actions service-editor-actions">
          <Link className="button button-secondary" to="/painel/servicos">Cancelar</Link>
          <button className="button" disabled={saving || Boolean(removingPhotoId) || Boolean(definingCoverId)} formNoValidate={galleryUncertain || mediaUncertain || creationUncertain} type="submit">
            {saving
              ? "Salvando..."
              : galleryUncertain || mediaUncertain
                ? "Verificar fotos"
                : creationUncertain
                ? "Verificar cadastro"
                : firstServiceOnboarding
                  ? "Salvar serviço e publicar"
                  : "Salvar serviço"}
          </button>
        </div>
      </form>
    </main>
  );
}
