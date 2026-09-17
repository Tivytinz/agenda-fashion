import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { getProfessionalWorkspacePath } from "../auth/session";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";

function formatExpiration(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function ProfessionalInvitesPage() {
  const session = useSession();
  const [items, setItems] = useState(null);
  const [loadingError, setLoadingError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [responding, setResponding] = useState(null);
  const [workspacePath, setWorkspacePath] = useState("");

  const load = useCallback(() => {
    setLoadingError("");

    apiRequest("/profissionais/convites/recebidos")
      .then((result) => {
        setItems(result.convites || []);
      })
      .catch((requestError) => {
        setLoadingError(requestError.message);
      });
  }, []);

  useEffect(load, [load]);

  async function respond(inviteId, action) {
    setResponding({ id: inviteId, action });
    setActionError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/profissionais/convites/${inviteId}/${action}`,
        { method: "POST" }
      );

      setItems((current) =>
        (current || []).filter(
          (invite) => Number(invite.id) !== Number(inviteId)
        )
      );

      setMessage(result.mensagem);

      if (action === "aceitar") {
        const refreshed = await session.refresh();
        setWorkspacePath(
          getProfessionalWorkspacePath(refreshed || session)
        );
      }
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setResponding(null);
    }
  }

  return (
    <main className="team-invites-page">
      <div className="container team-invites-container">
        <header className="team-invites-heading">
          <div>
            <p className="eyebrow">Equipe</p>
            <h1>Convites recebidos</h1>
            <p>
              Você só passa a fazer parte de um negócio depois de aceitar.
              Nenhum vínculo é criado automaticamente.
            </p>
          </div>

          <Link className="text-link" to="/conta">
            Minha conta
          </Link>
        </header>

        {message && (
          <div className="team-invite-success" role="status">
            <strong>{message}</strong>
            {workspacePath && (
              <Link className="button button-small" to={workspacePath}>
                Abrir minha área profissional
              </Link>
            )}
          </div>
        )}

        {actionError && (
          <p className="form-error" role="alert">{actionError}</p>
        )}

        {!items && !loadingError && (
          <LoadingState>Carregando convites...</LoadingState>
        )}

        {!items && loadingError && (
          <ErrorState message={loadingError} onRetry={load} />
        )}

        {items?.length === 0 && (
          <EmptyState title="Nenhum convite pendente">
            Quando um negócio convidar você para a equipe, o convite aparecerá
            aqui para aceite ou recusa.
          </EmptyState>
        )}

        {items?.length > 0 && (
          <section
            aria-label="Convites pendentes"
            className="team-invite-list"
          >
            {items.map((invite) => {
              const isResponding =
                Number(responding?.id) === Number(invite.id);
              const expiration = formatExpiration(invite.expira_em);

              return (
                <article className="team-invite-card" key={invite.id}>
                  <div className="team-invite-copy">
                    <span className="invite-status-badge">Pendente</span>
                    <h2>{invite.negocio_nome}</h2>
                    <p>
                      Este negócio quer adicionar você à equipe como
                      profissional.
                    </p>

                    {expiration && (
                      <small>
                        Convite válido até {expiration}.
                      </small>
                    )}
                  </div>

                  <div className="team-invite-actions">
                    <button
                      className="button button-secondary"
                      disabled={isResponding}
                      onClick={() => respond(invite.id, "recusar")}
                      type="button"
                    >
                      {isResponding && responding.action === "recusar"
                        ? "Recusando..."
                        : "Recusar"}
                    </button>

                    <button
                      className="button"
                      disabled={isResponding}
                      onClick={() => respond(invite.id, "aceitar")}
                      type="button"
                    >
                      {isResponding && responding.action === "aceitar"
                        ? "Aceitando..."
                        : "Aceitar convite"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
