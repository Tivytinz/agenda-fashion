import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { getBusinessWorkspacePath } from "../auth/session";
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

      const waitingForCapacity =
        action === "aceitar" &&
        result.vinculo?.ativo === false;

      setItems((current) =>
        waitingForCapacity
          ? (current || []).map((invite) =>
            Number(invite.id) === Number(inviteId)
              ? {
                  ...invite,
                  status: "aceito",
                  estado: "aguardando_vaga"
                }
              : invite
          )
          : (current || []).filter(
            (invite) => Number(invite.id) !== Number(inviteId)
          )
      );

      setMessage(result.mensagem);

      if (
        action === "aceitar" &&
        !waitingForCapacity
      ) {
        const refreshed = await session.refresh();
        setWorkspacePath(
          getBusinessWorkspacePath(
            refreshed || session,
            "profissional"
          )
        );
      } else {
        setWorkspacePath("");
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
          <EmptyState title="Nenhum convite ou vínculo aguardando vaga">
            Quando um negócio convidar você para a equipe, o convite aparecerá
            aqui. Aceites que dependem de capacidade também continuam visíveis
            até a dona liberar uma vaga.
          </EmptyState>
        )}

        {items?.length > 0 && (
          <section
            aria-label="Convites e vínculos de equipe"
            className="team-invite-list"
          >
            {items.map((invite) => {
              const isResponding =
                Number(responding?.id) === Number(invite.id);
              const expiration = formatExpiration(invite.expira_em);
              const waitingForCapacity =
                invite.estado === "aguardando_vaga";

              return (
                <article className="team-invite-card" key={invite.id}>
                  <div className="team-invite-copy">
                    <span className="invite-status-badge">
                      {waitingForCapacity ? "Aguardando vaga" : "Pendente"}
                    </span>
                    <h2>{invite.negocio_nome}</h2>
                    <p>
                      {waitingForCapacity
                        ? "Você aceitou este convite. O negócio precisa liberar uma vaga no plano antes de ativar seu acesso profissional."
                        : "Este negócio quer adicionar você à equipe como profissional."}
                    </p>

                    {!waitingForCapacity && expiration && (
                      <small>
                        Convite válido até {expiration}.
                      </small>
                    )}
                  </div>

                  {!waitingForCapacity && (
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
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
