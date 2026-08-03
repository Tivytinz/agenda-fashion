import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { BackLink } from "../components/BackLink";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCurrency } from "../utils/format";

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  categoria: "",
  valor: "",
  duracao_minutos: "60",
  ativo: true
};
const SERVICE_CATEGORIES = [
  ["unha", "Unhas"],
  ["cabelo", "Cabelos"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"],
  ["maquiagem", "Maquiagem"],
  ["estetica", "Estética"],
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

export function ServicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const removeDialogRef = useRef(null);
  const [services, setServices] = useState(null);
  const [error, setError] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);
  const [message] = useState(() => location.state?.message || "");

  const load = useCallback(() => {
    setError("");
    apiRequest("/servicos")
      .then((result) => setServices(extractServices(result)))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (location.state?.message) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  function askRemove(service) {
    setPendingRemove(service);
    removeDialogRef.current?.showModal();
  }

  async function remove() {
    if (!pendingRemove) return;
    setError("");
    try {
      await apiRequest(`/servicos/${pendingRemove.id}`, { method: "DELETE" });
      setServices((current) => current.filter((item) => item.id !== pendingRemove.id));
      removeDialogRef.current?.close();
      setPendingRemove(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="workspace-page">
      <div>
        <BackLink to="/painel">Voltar à visão geral</BackLink>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Seu catálogo</p>
            <h1>Serviços</h1>
            <p>Mostre o que você faz, quanto custa e por que a cliente vai amar.</p>
          </div>
          <Link className="button" to="/painel/servicos/novo">Novo serviço</Link>
        </header>
      </div>

      {error && services && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!services && !error && <LoadingState>Carregando serviços...</LoadingState>}
      {!services && error && <ErrorState message={error} onRetry={load} />}
      {services?.length === 0 && (
        <EmptyState
          action={<Link className="button" to="/painel/servicos/novo">Cadastrar primeiro serviço</Link>}
          title="Seu catálogo começa aqui"
        >
          Cadastre um serviço com foto para liberar o agendamento no perfil público.
        </EmptyState>
      )}
      {services?.length > 0 && (
        <section className="management-grid">
          {services.map((service) => (
            <article className="management-card" key={service.id}>
              <div className="service-cover">
                <MediaThumb
                  alt={`Capa do serviço ${service.nome}`}
                  className="management-service-media"
                  emoji="✦"
                  src={service.foto_url}
                />
              </div>
              <div className="management-card-body">
                <span className={service.ativo === false ? "status-badge status-cancelado" : "status-badge status-agendado"}>
                  {service.ativo === false ? "Inativo" : "Disponível"}
                </span>
                <h2>{service.nome}</h2>
                <p className="service-category-label">{categoryLabel(service.categoria)}</p>
                {service.descricao && <p className="service-description">{service.descricao}</p>}
                <p>{service.duracao_minutos || 0} min · <strong>{formatCurrency(service.valor)}</strong></p>
                <div className="card-actions">
                  <Link className="button button-secondary button-small" to={`/painel/servicos/${service.id}/editar`}>Editar</Link>
                  <button className="text-button danger-text" onClick={() => askRemove(service)} type="button">Remover</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <dialog className="cancel-dialog" ref={removeDialogRef}>
        <div className="cancel-dialog-content">
          <div className="cancel-dialog-icon">!</div>
          <h2>Remover serviço?</h2>
          <p>“{pendingRemove?.nome}” deixará de aparecer para novas clientes.</p>
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" onClick={() => { removeDialogRef.current?.close(); setPendingRemove(null); }} type="button">Manter serviço</button>
            <button className="button button-danger" onClick={remove} type="button">Sim, remover</button>
          </div>
        </div>
      </dialog>
    </main>
  );
}

export function ServiceEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cover, setCover] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [persistedId, setPersistedId] = useState(id || "");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState(null);
  const [error, setError] = useState("");
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : "", [cover]);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

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
          foto_url: service.foto_url || ""
        });
        setGallery(Array.isArray(galleryResult) ? galleryResult : galleryResult?.fotos || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

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
    setGalleryFiles(files);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    let savedId = persistedId;
    try {
      const result = await apiRequest(savedId ? `/servicos/${savedId}` : "/servicos", {
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
      savedId = result.servico?.id || savedId;
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
      navigate("/painel/servicos", {
        replace: true,
        state: { message: editing ? "Serviço atualizado." : "Serviço criado." }
      });
    } catch (requestError) {
      setError(`O serviço foi salvo, mas algumas fotos não foram enviadas. ${requestError.message} Tente novamente para enviar apenas as fotos pendentes.`);
    } finally {
      setSaving(false);
    }
  }

  async function removeGalleryPhoto(photo) {
    setRemovingPhotoId(photo.id);
    setError("");
    try {
      await apiRequest(`/servicos/fotos/${photo.id}`, { method: "DELETE" });
      setGallery((current) => current.filter((item) => item.id !== photo.id));
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
            <p>Uma boa imagem e uma descrição clara ajudam a cliente a escolher.</p>
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
          <label className="switch-field">
            <input checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} type="checkbox" />
            <span><strong>Serviço disponível</strong><small>Quando inativo, ele não aparece para novos agendamentos.</small></span>
          </label>
        </section>

        <section className="panel stack-form service-media-panel">
          <div><p className="eyebrow">Apresentação</p><h2>Fotos do serviço</h2></div>
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
          <label>
            Adicionar à galeria
            <input accept="image/jpeg,image/png,image/webp" multiple onChange={selectGallery} type="file" />
            <small>JPG, PNG ou WEBP, até 5 MB por foto.</small>
          </label>
          {galleryFiles.length > 0 && (
            <p className="upload-selection">{galleryFiles.length} {galleryFiles.length === 1 ? "foto nova selecionada" : "fotos novas selecionadas"}.</p>
          )}
          {gallery.length > 0 && (
            <div className="service-gallery" aria-label="Galeria atual">
              {gallery.map((photo) => (
                <figure key={photo.id}>
                  <MediaThumb alt={`Foto da galeria de ${form.nome}`} className="editor-media" emoji="✦" src={photo.foto_url} />
                  <button
                    aria-label="Remover foto da galeria"
                    disabled={removingPhotoId === photo.id}
                    onClick={() => removeGalleryPhoto(photo)}
                    type="button"
                  >
                    {removingPhotoId === photo.id ? "…" : "×"}
                  </button>
                </figure>
              ))}
            </div>
          )}
        </section>

        {error && <p className="form-error service-editor-message" role="alert">{error}</p>}
        <div className="form-actions service-editor-actions">
          <Link className="button button-secondary" to="/painel/servicos">Cancelar</Link>
          <button className="button" disabled={saving} type="submit">
            {saving ? "Salvando e enviando fotos..." : "Salvar serviço"}
          </button>
        </div>
      </form>
    </main>
  );
}
