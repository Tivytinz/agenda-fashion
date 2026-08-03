import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";

export function ProfessionalsPage() {
  const session = useSession();
  const removeDialogRef = useRef(null);
  const [items, setItems] = useState(null);
  const [invite, setInvite] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    apiRequest("/profissionais")
      .then((result) => setItems(result.profissionais || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  async function linkProfessional(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/profissionais/vincular", {
        method: "POST",
        body: { emailOuWhatsapp: invite.trim() }
      });
      setMessage(result.mensagem);
      setInvite("");
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pendingRemove) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest(`/profissionais/${pendingRemove.id}`, { method: "DELETE" });
      setMessage(result.mensagem);
      removeDialogRef.current?.close();
      setPendingRemove(null);
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div><p className="eyebrow">Sua equipe</p><h1>Profissionais</h1><p>Adicione quem atende no negócio e mantenha cada agenda separada.</p></div>
      </header>
      <form className="panel inline-form" onSubmit={linkProfessional}>
        <label>
          E-mail ou WhatsApp da profissional
          <input onChange={(event) => setInvite(event.target.value)} placeholder="Ela precisa já ter uma conta" required value={invite} />
        </label>
        <button className="button" disabled={saving} type="submit">{saving ? "Adicionando..." : "Adicionar à equipe"}</button>
      </form>
      {error && items && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!items && !error && <LoadingState>Carregando equipe...</LoadingState>}
      {!items && error && <ErrorState message={error} onRetry={load} />}
      {items?.length === 0 && <EmptyState title="Nenhuma profissional vinculada">Adicione uma conta existente pelo e-mail ou WhatsApp.</EmptyState>}
      {items?.length > 0 && (
        <section className="management-grid">
          {items.map((professional) => {
            const owner = Number(professional.id) === Number(session.usuario.id);
            return (
              <article className="management-card professional-card" key={professional.id}>
                <MediaThumb alt={`Foto de ${professional.nome}`} className="account-avatar" emoji={String(professional.nome || "P").slice(0, 1)} src={professional.foto_url} />
                <div><h2>{professional.nome}</h2><p className="muted">{owner ? "Dona do negócio" : "Profissional"}</p></div>
                {!owner && <button className="text-button danger-text" onClick={() => { setPendingRemove(professional); removeDialogRef.current?.showModal(); }} type="button">Remover</button>}
              </article>
            );
          })}
        </section>
      )}
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
          <div aria-hidden="true" className="cancel-dialog-icon">!</div><h2 id="remove-professional-title">Remover da equipe?</h2>
          <p>{pendingRemove?.nome} perderá o acesso a este negócio. A conta pessoal dela continuará existindo.</p>
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" disabled={saving} onClick={() => { removeDialogRef.current?.close(); setPendingRemove(null); }} type="button">Manter profissional</button>
            <button className="button button-danger" disabled={saving} onClick={remove} type="button">{saving ? "Removendo..." : "Sim, remover"}</button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
