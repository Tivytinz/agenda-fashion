import { useBusinessEditor } from "../features/business/useBusinessEditor";
import { BRAZILIAN_STATES } from "../features/business/form";
import { getPlanIntentPath } from "../auth/session";
import { Link } from "react-router-dom";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { CategoryEmoji } from "../components/CategoryEmoji";
import { SetupFlowFrame, SetupTitle } from "../components/SetupFlowFrame";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatWhatsApp } from "../utils/format";
import {
  BUSINESS_SPECIALTIES,
  serviceCategoryEmoji
} from "../utils/specialties";

export function BusinessPage({ create = false }) {
  const {
    formRef,
    timeZoneOptions,
    mapSuggestion,
    suggestMapLink,
    selectedPlan,
    form,
    savedForm,
    loading,
    saving,
    photoUploading,
    error,
    message,
    publication,
    publishing,
    closingBusiness,
    closureUncertain,
    contextInvalid,
    creationUncertain,
    creationEnded,
    setLoadAttempt,
    closurePendings,
    cepLookup,
    mutationBusy,
    unsavedChanges,
    hasChanges,
    publicUrl,
    locationValid,
    staleMapSearch,
    whatsappError,
    discardPendingOperations,
    update,
    toggleSpecialty,
    handleCepChange,
    handleCepBlur,
    copyPublicUrl,
    submit,
    uploadPhoto,
    closeBusiness,
    togglePublication
  } = useBusinessEditor({ create });

  if (loading) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><LoadingState>Carregando negócio...</LoadingState></main>;
  if (error && !form.nome && !create) return <main className="workspace-page"><ErrorState message={error} /></main>;

  const firstStepPath = create ? getPlanIntentPath("/cadastro?tipo=profissional", selectedPlan) : undefined;

  const addressFields = (
    <div className="form-grid business-address-grid">
      <label className="business-cep-field">
        CEP
        <input
          aria-busy={cepLookup.status === "loading" ? "true" : undefined}
          aria-invalid={cepLookup.status === "error" ? "true" : undefined}
          autoComplete="postal-code"
          disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
          name="cep"
          inputMode="numeric"
          maxLength="9"
          onBlur={handleCepBlur}
          onChange={handleCepChange}
          placeholder="00000-000"
          required={create}
          value={form.cep}
        />
        <small
          aria-live="polite"
          className={`field-helper cep-lookup-helper is-${cepLookup.status}`}
        >
          {cepLookup.message || "Ao completar o CEP, rua, bairro, cidade e estado serão preenchidos."}
        </small>
      </label>
      <span className="field-wide business-address-divider" aria-hidden="true" />
      <label>
        Endereço
        <input autoComplete="street-address" maxLength="180" name="endereco" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("endereco", event.target.value)} required={create} value={form.endereco} />
      </label>
      <label>
        Número
        <input maxLength="20" name="numero" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("numero", event.target.value)} required={create} value={form.numero} />
      </label>
      <label>
        {create ? "Complemento (opcional)" : "Complemento"}
        <input maxLength="120" name="complemento" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("complemento", event.target.value)} value={form.complemento} />
      </label>
      <label>
        Bairro
        <input maxLength="100" name="bairro" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("bairro", event.target.value)} required={create} value={form.bairro} />
      </label>
      <label>
        Cidade
        <input maxLength="100" name="cidade" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("cidade", event.target.value)} required={create} value={form.cidade} />
      </label>
      <label>
        Estado
        <select aria-label="Estado" name="estado" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("estado", event.target.value)} required value={form.estado}>
          <option value="">Selecione a UF</option>
          {BRAZILIAN_STATES.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </label>
      {form.estado && timeZoneOptions.length > 0 && (
        <div className="field-wide">
          {timeZoneOptions.length > 1 ? (
            <label>
              Fuso horário do atendimento
              <select name="fuso_horario" required disabled={mutationBusy}
                value={form.fuso_horario}
                onChange={(event) => update("fuso_horario", event.target.value)}>
                <option value="">Selecione o fuso da sua cidade</option>
                {timeZoneOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              <small>O horário escolhido será usado na agenda. Alterações com reservas futuras ativas precisam ser resolvidas antes de salvar.</small>
            </label>
          ) : (
            <small>Horário local: {timeZoneOptions[0].label}.</small>
          )}
        </div>
      )}
    </div>
  );

  return (
    <SetupFlowFrame backDisabled={mutationBusy} backTo={firstStepPath} enabled={create} exitTo={selectedPlan ? "/planos" : "/"} step={2}>
    <main className={create ? "container page-content narrow-page" : "workspace-page business-settings-page"}>
      <UnsavedChangesGuard when={unsavedChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} preserveOnNavigateTo={create && !mutationBusy ? firstStepPath : undefined} />
      <header className="workspace-heading">
        <div>
          {!create && <p className="eyebrow">Presença pública</p>}
          <SetupTitle emoji={create ? "🏪" : undefined}>{create ? "Seu negócio" : "Meu negócio"}</SetupTitle>
          <p>
            {create
              ? "Vamos apresentar seu negócio às clientes."
              : "Esses dados ajudam clientes a encontrar, confiar e agendar com você."}
          </p>
        </div>
      </header>

      {!create && publication && (
        <section className={`panel publication-panel ${publication.publicado ? "publication-panel-live" : ""}`}>
          <div>
            <p className="eyebrow">Descoberta no Agenda Fashion</p>
            <h2>{publication.publicado ? "Seu negócio está visível para clientes" : "Seu negócio não está aparecendo na busca"}</h2>
            <p>
              {publication.publicado
                ? "Clientes podem encontrar seus serviços e acessar seu perfil público."
                : publication.oculto_manual
                  ? "Você ocultou este negócio. Ele continuará fora da busca e do perfil público até você escolher Mostrar na busca."
                  : "A publicação acontece automaticamente com os dados essenciais e pelo menos um serviço ativo. O AF já prepara uma sugestão de horários, que pode ser alterada depois."}
            </p>
            {!publication.pode_publicar && publication.pendencias.length > 0 && (
              <p className="publication-pending">
                Falta completar: {publication.pendencias.join(", ")}.
              </p>
            )}
          </div>
          <div className="publication-actions">
            {form.slug && (
              <Link className="button button-secondary" to={`/negocio/${encodeURIComponent(form.slug)}`}>
                Ver meu perfil público
              </Link>
            )}
            <button
              className={publication.publicado
                ? "button button-secondary business-publication-toggle is-danger"
                : "button business-publication-toggle"}
              disabled={mutationBusy || (!publication.publicado && !publication.pode_publicar)}
              onClick={togglePublication}
              type="button"
            >
              {publishing
                ? "Atualizando..."
                : publication.publicado
                  ? "Ocultar da busca"
                  : "Mostrar na busca"}
            </button>
          </div>
        </section>
      )}

      <form aria-busy={mutationBusy} className="panel stack-form business-settings-form" onSubmit={submit} ref={formRef}>
        {!create && (
          <section className="business-form-section business-photo-section">
            <div className="business-form-heading">
              <p className="eyebrow">Foto</p>
              <h2>Imagem do negócio</h2>
              <p>Essa imagem aparece na busca, no perfil público e nos seus cards.</p>
            </div>
            <div className="business-photo-editor">
              <MediaThumb
                alt={`Foto do negócio ${form.nome || "Agenda Fashion"}`}
                className="business-photo-preview"
                src={form.foto_url}
              />
              <div className="business-photo-controls">
                <label className="button button-secondary button-small">
                  {photoUploading
                    ? "Enviando..."
                    : form.foto_url
                      ? "Trocar foto"
                      : "Adicionar foto"}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={mutationBusy}
                    onChange={uploadPhoto}
                    type="file"
                  />
                </label>
                <small>JPG, PNG ou WEBP · até 5 MB.</small>
              </div>
            </div>
          </section>
        )}

        <section className="business-form-section">
          {!create && <div className="business-form-heading">
            <p className="eyebrow">Identidade</p>
            <h2>Como clientes encontram você</h2>
          </div>}
          <div className="form-grid">
            <label className="field-wide">
              {create ? <span className="business-field-label"><span aria-hidden="true" className="business-field-emoji">🏷️</span>Nome do negócio</span> : "Nome do negócio"}
              <input aria-label={create ? "Nome do negócio" : undefined} disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} minLength="2" maxLength="120" name="nome" onChange={(event) => update("nome", event.target.value)} required value={form.nome} />
            </label>
            {!create && form.slug && (
              <div className="field-wide public-address-card" data-testid="public-address-hint">
                <div className="public-address-copy">
                  <span>Seu link público</span>
                  <strong>{publicUrl}</strong>
                  <small>Alterar o nome também atualiza este endereço. Links antigos continuam funcionando.</small>
                </div>
                <button className="button button-secondary button-small" onClick={copyPublicUrl} type="button">
                  Copiar link
                </button>
              </div>
            )}
            <label className="field-wide">
              {create ? <span className="business-field-label"><span aria-hidden="true" className="business-field-emoji">📝</span>Descrição (opcional)</span> : "Descrição (opcional)"}
              <textarea
                aria-label={create ? "Descrição (opcional)" : undefined}
                disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
                maxLength="1000"
                onChange={(event) => update("descricao", event.target.value)}
                rows="4"
                value={form.descricao}
              />
              {!create && <small>Ajuda clientes a conhecerem seu trabalho, mas não impede a criação nem a publicação.</small>}
            </label>
            <fieldset aria-label="Especialidades" className="specialty-field field-wide" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}>
              <div className="specialty-heading-row">
                <p>{create ? <><span aria-hidden="true" className="business-field-emoji">💖</span>Especialidades</> : "Selecione tudo o que o negócio oferece."}</p>
              </div>
              <div className="specialty-selector">
                {BUSINESS_SPECIALTIES.map(([value, label]) => (
                  <label className={form.areas.includes(value) ? "specialty-option selected" : "specialty-option"} key={value}>
                    <input
                      aria-label={create ? label : undefined}
                      checked={form.areas.includes(value)}
                      name="areas"
                      onChange={() => toggleSpecialty(value)}
                      type="checkbox"
                    />
                    {create && <CategoryEmoji emoji={serviceCategoryEmoji(value)} />}
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="business-form-section">
          <div className="business-form-heading">
            {!create && <p className="eyebrow">Contato</p>}
            <h2>{create ? <><span aria-hidden="true" className="business-section-emoji">💬</span>Contato</> : "Como falar com o negócio"}</h2>
          </div>
          <div className="form-grid">
            <label>
              WhatsApp
              <input
                autoComplete="tel"
                disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
                aria-invalid={whatsappError ? "true" : undefined}
                inputMode="tel"
                maxLength="15"
                name="whatsapp"
                onChange={(event) => update("whatsapp", formatWhatsApp(event.target.value))}
                placeholder="(00) 12345-6789"
                required={create}
                value={form.whatsapp}
              />
              {(!create || whatsappError) && <small className={whatsappError ? "field-helper is-error" : "field-helper"}>
                {whatsappError || (create
                  ? "Trouxemos o número da sua conta. Você pode trocar antes de continuar."
                  : "Usado para confirmações e contato das clientes.")}
              </small>}
            </label>
          </div>
        </section>

        <section className="business-form-section business-address-section">
          <div className="business-form-heading">
            {!create && <p className="eyebrow">Endereço</p>}
            <h2>{create ? <><span aria-hidden="true" className="business-section-emoji">📍</span>Endereço</> : "Onde acontece o atendimento"}</h2>
            {!create && <p>Comece pelo CEP e complete os detalhes do local.</p>}
          </div>
          {addressFields}
          <div className="form-grid">
            <label className="field-wide">
              Link da localização
              <input
                name="localizacao_url"
                aria-invalid={!locationValid ? "true" : undefined}
                disabled={mutationBusy}
                onChange={(event) => update("localizacao_url", event.target.value)}
                placeholder="https://maps.google.com/..."
                required={create}
                type="url"
                value={form.localizacao_url}
              />
              <span className="maps-field-helper">
                <small className={!locationValid ? "field-helper is-error" : "field-helper"}>
                  {!locationValid
                    ? staleMapSearch
                      ? "O endereço mudou. Gere novamente o link de busca ou cole outro link válido."
                      : "Use um link HTTPS do Google Maps ou Apple Mapas."
                    : create ? "Confira se o endereço indicado no mapa está correto." : "Cole um link do Google Maps ou Apple Mapas."}
                </small>
                {locationValid && form.localizacao_url && (
                  <a href={form.localizacao_url} rel="noopener noreferrer" target="_blank">Conferir no mapa ↗</a>
                )}
              </span>
            </label>
            {(create || staleMapSearch) && (
              <div className="field-wide">
                <button type="button" className="button button-secondary button-small"
                  disabled={!mapSuggestion || mutationBusy} onClick={suggestMapLink}>
                  Gerar link de busca a partir do endereço
                </button>
              </div>
            )}
          </div>
        </section>

        {error && <p className="form-error business-form-feedback" role="alert">{error}</p>}
        {contextInvalid && <button className="button button-secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Atualizar Meu negócio</button>}
        {creationEnded && <Link className="button button-secondary" to="/">Voltar ao início</Link>}
        {!create && message && (
          <div className="business-save-toast" role="status">
            <ConfirmationIcon className="business-save-icon" />
            <span>{message}</span>
          </div>
        )}
        {create && message && <p className="form-success" role="status">{message}</p>}
        {(create || hasChanges || saving) && (
          <div className={create ? "form-actions business-save-actions" : "business-floating-save"}>
            <button className="button" disabled={saving || photoUploading || publishing || closingBusiness || closureUncertain || contextInvalid || creationEnded || cepLookup.status === "loading"} formNoValidate={creationUncertain} type="submit">
              {saving ? "Salvando..." : creationUncertain ? "Verificar negócio" : create ? "Criar negócio" : "Salvar alterações"}
            </button>
          </div>
        )}
      </form>

      {!create && (
        <section className="panel stack-form business-danger-zone">
          <div>
            <p className="eyebrow">Encerramento</p>
            <h2>Encerrar este negócio</h2>
            <p className="muted">
              O encerramento é permanente no fluxo normal. Antes de arquivar, o AF
              exige que agendamentos confirmados e pendências de cobrança estejam resolvidos.
            </p>
          </div>

          {closurePendings.length > 0 && (
            <div role="alert">
              <strong>Resolva antes de encerrar:</strong>
              <ul>
                {closurePendings.map((pending) => (
                  <li key={pending.codigo}>
                    {pending.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="button button-secondary danger-text"
            disabled={saving || photoUploading || publishing || closingBusiness || contextInvalid || !savedForm.id}
            onClick={closeBusiness}
            type="button"
          >
            {closingBusiness ? "Verificando pendências..." : closureUncertain ? "Verificar encerramento" : "Encerrar negócio"}
          </button>
        </section>
      )}
    </main>
    </SetupFlowFrame>
  );
}
