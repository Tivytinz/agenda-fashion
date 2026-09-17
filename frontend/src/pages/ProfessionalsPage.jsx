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
  const [lastInvite, setLastInvite] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiRequest("/profissionais")
      .then((result) => setItems(result.profissionais || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  async function sendInvite(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setLastInvite(null);

    try {
      const result = await apiRequest("/profissionais/convites", {
        method: "POST",
        body: { emailOuWhatsapp: invite.trim() }
      });

      setMessage(
        result.mensagem ||
        "Convite enviado. A profissional precisa aceitar antes de entrar na equipe."
      );
      setLastInvite(result.convite || null);
      setInvite("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pendingRemove) return;
    setSaving(true);
    setRemoveError("");

    try {
      const result = await apiRequest(`/profissionais/${pendingRemove.id}`, {
        method: "DELETE"
      });
      setMessage(result.mensagem);
      removeDialogRef.current?.close();
      setPendingRemove(null);
      load();
    } catch (requestError) {
      setRemoveError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

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

        <button className="button" disabled={saving} type="submit">
          {saving ? "Enviando convite..." : "Enviar convite"}
        </button>
      </form>

      {error && items && (
        <p className="form-error" role="alert">{error}</p>
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

      {!items && !error && (
        <LoadingState>Carregando equipe...</LoadingState>
      )}

      {!items && error && (
        <ErrorState message={error} onRetry={load} />
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
                    {owner ? "Dona do negócio" : "Profissional"}
                  </p>
                </div>

                {!owner && (
                  <button
                    className="text-button danger-text"
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
          <div aria-hidden="true" className="cancel-dialog-icon">!</div>

          <h2 id="remove-professional-title">Remover da equipe?</h2>

          <p>
            {pendingRemove?.nome} perderá o acesso a este negócio. A conta
            pessoal dela continuará existindo.
          </p>

          <p className="muted">
            A remoção só é permitida quando não existem agendamentos futuros
            ativos dessa profissional neste negócio.
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
