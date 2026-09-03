import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCurrency } from "../utils/format";

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

function extractServices(result) {
  return Array.isArray(result) ? result : result?.servicos || [];
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

async function uploadImage(path, file) {
  const body = new FormData();
  body.append("foto", file);
  return apiRequest(path, { method: "POST", body });
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
  const [error, setError] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [message] = useState(() => location.state?.message || "");

  const activeCount = services?.filter((service) => service.ativo !== false).length || 0;
  const serviceLimit = serviceUsage?.limite_servicos === null || serviceUsage?.limite_servicos === undefined
    ? null
    : Number(serviceUsage.limite_servicos);
  const atServiceLimit = serviceLimit !== null && activeCount >= serviceLimit;

  const load = useCallback(() => {
    setError("");
    Promise.all([
      apiRequest("/servicos"),
      apiRequest("/minha-assinatura").catch(() => null)
    ])
      .then(([servicesResult, subscriptionResult]) => {
        setServices(extractServices(servicesResult));
        setServiceUsage(subscriptionResult?.uso || null);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (location.state?.message) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  function askRemove(service) {
    setRemoveError("");
    setPendingRemove(service);
    removeDialogRef.current?.showModal();
  }

  async function toggleServiceVisibility(service) {
    if (togglingId) return;

    const nextActive = service.ativo === false;

    if (nextActive && atServiceLimit) {
      setError(`Seu plano permite até ${serviceLimit} serviço(s) ativo(s). Desative um serviço antes de escolher outro.`);
      return;
    }

    setTogglingId(service.id);
    setError("");
    setVisibilityMessage("");

    try {
      const result = await apiRequest(`/servicos/${service.id}/ativo`, {
        method: "PATCH",
        body: { ativo: nextActive }
      });
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
      setError(requestError.message);
    } finally {
      setTogglingId(null);
    }
  }

  async function remove() {
    if (!pendingRemove || removing) return;
    setRemoving(true);
    setRemoveError("");
    try {
      await apiRequest(`/servicos/${pendingRemove.id}`, { method: "DELETE" });
      setServices((current) => current.filter((item) => item.id !== pendingRemove.id));
      removeDialogRef.current?.close();
      setPendingRemove(null);
    } catch (requestError) {
      setRemoveError(requestError.message);
    } finally {
      setRemoving(false);
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

      {error && services && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {visibilityMessage && <p className="form-success" role="status">{visibilityMessage}</p>}
      {!services && !error && <LoadingState>Carregando serviços...</LoadingState>}
      {!services && error && <ErrorState message={error} onRetry={load} />}
      {services?.length === 0 && (
        <EmptyState
          action={<Link className="button" to="/painel/servicos/novo">Cadastrar primeiro serviço</Link>}
          title="💅 Seu catálogo começa aqui"
        >
          Cadastre seu primeiro serviço. Nos novos cadastros, depois confirme seus horários para colocar o perfil no ar. Fotos ajudam a cliente a escolher, mas podem ser adicionadas depois.
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
                    disabled={Boolean(togglingId) || activatingBlocked}
                    onClick={() => toggleServiceVisibility(service)}
                    title={activatingBlocked ? `Desative um dos ${serviceLimit} serviços ativos para liberar esta vaga.` : undefined}
                    type="button"
                  >
                    {toggling ? "Atualizando..." : active ? "Ocultar do perfil" : "Ativar no perfil"}
                  </button>
                  <div className="card-actions">
                    <Link className="button button-secondary button-small" to={`/painel/servicos/${service.id}/editar`}>Editar</Link>
                    <button className="text-button danger-text" onClick={() => askRemove(service)} type="button">Remover</button>
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
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const editing = Boolean(id);
  const firstServiceOnboarding =
    !editing
    && location.state?.onboarding === true
    && location.state?.onboardingStep === "servico";
  const [form, setForm] = useState(EMPTY_FORM);
  const [cover, setCover] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [persistedId, setPersistedId] = useState(id || "");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState(null);
  const [definingCoverId, setDefiningCoverId] = useState(null);
  const [mediaMessage, setMediaMessage] = useState("");
  const [error, setError] = useState("");
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

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    if (!mediaMessage) return undefined;
    const timeoutId = window.setTimeout(() => setMediaMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [mediaMessage]);

  useEffect(() => {
    if (!editing) return;

    Promise.all([
      apiRequest("/servicos"),
      apiRequest(`/servicos/${encodeURIComponent(id)}/fotos`)
    ])
      .then(([servicesResult, galleryResult]) => {
        const service = extractServices(servicesResult).find((item) => Number(item.id) === Number(id));
        if (!service) throw new Error("Serviço não encontrado.");
        setForm({
          nome: service.nome || "",
          descricao: service.descricao || "",
          categoria: service.categoria || "",
          valor: String(service.valor ?? ""),
          duracao_minutos: String(service.duracao_minutos ?? 60),
          ativo: service.ativo !== false,
          foto_url: service.foto_url || "",
          foto_public_id: service.foto_public_id || ""
        });
        setGallery(Array.isArray(galleryResult) ? galleryResult : galleryResult?.fotos || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

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
  }

  function selectGallery(event) {
    const files = Array.from(event.target.files || []);
    const validationError = files.map(validateImage).find(Boolean);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setMediaMessage("");
    setGalleryFiles(files);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMediaMessage("");
    let savedId = persistedId;
    let saveResult = null;
    try {
      saveResult = await apiRequest(savedId ? `/servicos/${savedId}` : "/servicos", {
        method: savedId ? "PUT" : "POST",
        body: {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria,
          valor: Number(form.valor),
          duracao_minutos: Number(form.duracao_minutos),
          ativo: form.ativo
        }
      });
      savedId = saveResult.servico?.id || savedId;
      if (!savedId) {
        throw new Error("O serviço foi salvo, mas não foi possível identificar o cadastro.");
      }
      setPersistedId(String(savedId));
    } catch (requestError) {
      setError(requestError.message);
      setSaving(false);
      return;
    }

    try {
      if (cover) {
        await uploadImage(`/servicos/${savedId}/foto`, cover);
        setCover(null);
      }
      for (const file of galleryFiles) {
        await uploadImage(`/servicos/${savedId}/fotos`, file);
        setGalleryFiles((current) => current.filter((item) => item !== file));
      }
      const continueOnboarding = !editing && location.state?.onboarding === true;
      const onboardingAlreadyPublished =
        continueOnboarding &&
        saveResult.publicacao?.publicado === true;

      navigate(
        continueOnboarding
          ? "/painel/horarios"
          : "/painel/servicos",
        {
          replace: true,
          state: continueOnboarding
            ? {
                message:
                  onboardingAlreadyPublished
                    ? "Seu perfil está no ar. Agora confirme quando você atende para liberar os agendamentos online."
                    : "Serviço cadastrado. Agora confirme seus horários para publicar o perfil e liberar agendamentos online.",
                onboarding: true,
                onboardingStep: "agenda"
              }
            : {
                message: editing
                  ? "Serviço atualizado."
                  : "Serviço criado."
              }
        }
      );
    } catch (requestError) {
      setError(`O serviço foi salvo, mas algumas fotos não foram enviadas. ${requestError.message} Tente novamente para enviar apenas as fotos pendentes.`);
    } finally {
      setSaving(false);
    }
  }

  async function chooseGalleryCover(photo) {
    if (!persistedId || definingCoverId || isGalleryCover(photo) || photo.virtualCover) return;

    const previousCover = {
      foto_url: form.foto_url,
      foto_public_id: form.foto_public_id
    };

    setDefiningCoverId(photo.id);
    setError("");
    setMediaMessage("");
    setCover(null);
    setForm((current) => ({
      ...current,
      foto_url: photo.foto_url || "",
      foto_public_id: photo.foto_public_id || ""
    }));

    try {
      const result = await apiRequest(`/servicos/${persistedId}/capa`, {
        method: "PUT",
        body: { foto_id: photo.id }
      });
      const service = result.servico || {};
      setForm((current) => ({
        ...current,
        foto_url: service.foto_url || photo.foto_url || "",
        foto_public_id: service.foto_public_id || photo.foto_public_id || ""
      }));
      setMediaMessage("Foto escolhida como capa do serviço.");
    } catch (requestError) {
      setForm((current) => ({
        ...current,
        foto_url: previousCover.foto_url,
        foto_public_id: previousCover.foto_public_id
      }));
      setError(requestError.message);
    } finally {
      setDefiningCoverId(null);
    }
  }

  async function removeGalleryPhoto(photo) {
    if (photo.virtualCover) return;
    const wasCover = isGalleryCover(photo);
    setRemovingPhotoId(photo.id);
    setError("");
    setMediaMessage("");
    try {
      const result = await apiRequest(`/servicos/fotos/${photo.id}`, { method: "DELETE" });
      setGallery((current) => current.filter((item) => item.id !== photo.id));
      if (wasCover || result.capa_removida) {
        setForm((current) => ({ ...current, foto_url: "", foto_public_id: "" }));
        setMediaMessage("A foto foi removida. Escolha outra imagem para a capa.");
      } else {
        setMediaMessage("Foto removida da galeria.");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRemovingPhotoId(null);
    }
  }

  if (loading) return <div className="workspace-page"><LoadingState>Carregando serviço...</LoadingState></div>;

  return (
    <main className="workspace-page service-editor-page">
      <div>
        <BackLink to="/painel/servicos">Voltar aos serviços</BackLink>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h1>{editing ? "Editar serviço" : "Novo serviço"}</h1>
            <p>
              {firstServiceOnboarding
                ? "Para continuar, informe nome, categoria, valor e duração. Descrição e fotos podem ser adicionadas depois."
                : "Preencha os dados do serviço. Fotos e descrição ajudam a cliente a escolher, mas podem ser melhoradas depois."}
            </p>
          </div>
        </header>
      </div>

      <form className="service-editor-grid" onSubmit={submit}>
        <section className="panel stack-form">
          <div><p className="eyebrow">Informações</p><h2>Detalhes do serviço</h2></div>
          <label>
            Nome do serviço
            <input minLength="2" onChange={(event) => setForm({ ...form, nome: event.target.value })} required value={form.nome} />
          </label>
          <label>
            Categoria
            <select
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
              <input min="0" onChange={(event) => setForm({ ...form, valor: event.target.value })} required step="0.01" type="number" value={form.valor} />
            </label>
            <label>
              Duração em minutos
              <input min="5" onChange={(event) => setForm({ ...form, duracao_minutos: event.target.value })} required step="5" type="number" value={form.duracao_minutos} />
            </label>
          </div>
          {!firstServiceOnboarding && (
            <label className="switch-field">
              <input checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} type="checkbox" />
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
                  <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectCover} type="file" />
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
                              disabled={removingPhotoId === photo.id || choosing}
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
                              disabled={choosing || removingPhotoId === photo.id}
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

        {error && <p className="form-error service-editor-message" role="alert">{error}</p>}
        <div className="form-actions service-editor-actions">
          <Link className="button button-secondary" to="/painel/servicos">Cancelar</Link>
          <button className="button" disabled={saving} type="submit">
            {saving
              ? firstServiceOnboarding
                ? "Salvando..."
                : "Salvando e enviando fotos..."
              : "Salvar serviço"}
          </button>
        </div>
      </form>
    </main>
  );
}
