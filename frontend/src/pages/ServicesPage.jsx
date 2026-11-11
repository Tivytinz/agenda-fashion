import { useServiceEditor } from "../features/services/useServiceEditor";
import { Link } from "react-router-dom";
import { SetupFlowFrame, SetupTitle } from "../components/SetupFlowFrame";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import { MediaThumb } from "../components/profile/MediaThumb";
import { FileImagePreview } from "../components/FileImagePreview";
import { SERVICE_CATEGORIES } from "../utils/serviceCatalog";

// Preserva a importação existente do catálogo durante a separação dos módulos.
export { ServicesPage } from "./ServiceCatalogPage";

export function ServiceEditorPage() {
  const {
    galleryRef,
    editing,
    firstServiceOnboarding,
    form,
    setForm,
    cover,
    galleryFiles,
    loading,
    loadError,
    recoveryRemoved,
    recoveryMessage,
    setLoadAttempt,
    galleryLoading,
    galleryError,
    setGalleryLoadAttempt,
    saving,
    creationUncertain,
    galleryUncertain,
    mediaUncertain,
    removingPhotoId,
    definingCoverId,
    mediaMessage,
    error,
    fieldsDisabled,
    mediaBusy,
    hasChanges,
    galleryItems,
    discardPendingOperations,
    isGalleryCover,
    scrollGallery,
    selectCover,
    selectGallery,
    submit,
    chooseGalleryCover,
    removeGalleryPhoto
  } = useServiceEditor();

  if (loading) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><LoadingState>Carregando serviço...</LoadingState></main>;
  if (loadError) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><BackLink to="/painel/servicos">Voltar aos serviços</BackLink><ErrorState message={loadError} onRetry={recoveryRemoved ? undefined : () => setLoadAttempt((attempt) => attempt + 1)} /></main>;

  return (
    <SetupFlowFrame enabled={firstServiceOnboarding} exitTo="/painel" step={3}>
    <main className="workspace-page service-editor-page">
      <UnsavedChangesGuard when={hasChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} />
      <div>
        {!firstServiceOnboarding && <BackLink to="/painel/servicos">Voltar aos serviços</BackLink>}
        <header className="workspace-heading">
          <div>
            <SetupTitle emoji={firstServiceOnboarding ? "💅" : undefined}>{editing ? "Editar serviço" : "Novo serviço"}</SetupTitle>
            <p>
              Qual cuidado você vai oferecer?
            </p>
          </div>
        </header>
      </div>

      <form aria-busy={saving} aria-label="Dados do serviço" className="service-editor-grid" onSubmit={submit}>
        <section className="panel stack-form">
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
          </label>
          <label>
            Descrição (opcional)
            <textarea
              disabled={fieldsDisabled}
              maxLength="1200"
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
              placeholder="Explique o resultado, materiais ou diferenciais."
              rows="3"
              value={form.descricao}
            />
            <small>{form.descricao.length}/1200 caracteres</small>
          </label>
          <div className="form-grid">
            <label>
              Valor (R$)
              <input disabled={fieldsDisabled} inputMode="decimal" min="0" onChange={(event) => setForm({ ...form, valor: event.target.value })} required step="0.01" type="number" value={form.valor} />
            </label>
            <label>
              Duração em minutos
              <input disabled={fieldsDisabled} inputMode="numeric" min="5" onChange={(event) => setForm({ ...form, duracao_minutos: event.target.value })} required step="5" type="number" value={form.duracao_minutos} />
            </label>
          </div>
          <label className="switch-field">
            <input checked={form.ativo} disabled={fieldsDisabled} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} type="checkbox" />
            <span><strong>Serviço disponível</strong><small>Quando inativo, ele não aparece para novos agendamentos.</small></span>
          </label>
        </section>

        <section className="panel stack-form service-media-panel">
          <div>
            <h2>Fotos do serviço</h2>
            <p className="muted service-media-help">Mostre seu talento. Fotos são opcionais.</p>
          </div>

          <div className="service-cover-section">
            <div className="service-media-section-heading">
              <strong>Capa do serviço</strong>
            </div>
            <div className="cover-upload">
              <div className="cover-preview">
                {cover
                  ? <FileImagePreview alt="Prévia da nova capa" file={cover} />
                  : form.foto_url
                    ? <MediaThumb alt={`Capa atual do serviço ${form.nome}`} className="editor-media" emoji="📷" src={form.foto_url} />
                    : <span><strong aria-hidden="true" className="native-emoji">📷</strong>Adicione uma foto de capa</span>}
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
                        <MediaThumb alt={`Foto da galeria de ${form.nome}`} className="editor-media" emoji="📷" src={photo.foto_url} />
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
                            <span>Capa atual</span>
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
                : "Salvar serviço"}
          </button>
        </div>
      </form>
    </main>
    </SetupFlowFrame>
  );
}
