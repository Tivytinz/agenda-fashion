import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency, formatDate } from "../utils/format";

function GuestCancelDialog({ booking, canceling, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (booking && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    }
    if (!booking && dialog.open) dialog.close();
  }, [booking]);

  return (
    <dialog
      aria-labelledby="guest-cancel-dialog-title"
      className="cancel-dialog"
      onCancel={(event) => {
        if (canceling) {
          event.preventDefault();
          return;
        }
        onClose();
      }}
      ref={dialogRef}
    >
      {booking && (
        <div className="cancel-dialog-content">
          <span className="cancel-dialog-icon" aria-hidden="true">!</span>
          <p className="eyebrow">Confirmar cancelamento</p>
          <h2 id="guest-cancel-dialog-title">Cancelar este agendamento?</h2>
          <p>
            {booking.servico_nome || "Serviço"} em {formatDate(booking.data, true)} às{" "}
            {booking.horario}.
          </p>
          <p className="cancel-dialog-warning">
            O horário será liberado para outra cliente. Essa ação não pode ser desfeita.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="cancel-dialog-actions">
            <button
              className="button button-secondary"
              disabled={canceling}
              onClick={onClose}
              ref={cancelButtonRef}
              type="button"
            >
              Manter agendamento
            </button>
            <button
              className="button button-danger"
              disabled={canceling}
              onClick={onConfirm}
              type="button"
            >
              {canceling ? "Cancelando..." : "Sim, cancelar"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export function GuestBookingAccessPage() {
  const { id } = useParams();
  const location = useLocation();
  const hashParams = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  const token = hashParams.get("token") || "";
  const [booking, setBooking] = useState(null);
  const [canCancel, setCanCancel] = useState(false);
  const [cancelUnavailable, setCancelUnavailable] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [confirmingCancellation, setConfirmingCancellation] = useState(false);
  const cancelTriggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(`/agendamentos/${id}/acesso-visitante`, {
      headers: { "X-Agenda-Access": token }
    })
      .then((result) => {
        if (!active) return;
        setBooking(result.agendamento || null);
        setCanCancel(result.pode_cancelar === true);
        setCancelUnavailable(result.cancelamento_indisponivel || "");
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, token]);

  function closeCancellationDialog() {
    if (canceling) return;
    setConfirmingCancellation(false);
    setError("");
    requestAnimationFrame(() => cancelTriggerRef.current?.focus());
  }

  async function cancelBooking() {
    setCanceling(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(`/agendamentos/${id}/cancelar-visitante`, {
        method: "PATCH",
        body: { acesso_visitante: token }
      });
      setBooking((current) => ({
        ...current,
        ...(result.agendamento || {}),
        status: result.agendamento?.status || "cancelado"
      }));
      setCanCancel(false);
      setCancelUnavailable("");
      setConfirmingCancellation(false);
      setMessage(result.mensagem || "Agendamento cancelado com sucesso.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling(false);
    }
  }

  if (loading) return <main className="container page-content narrow-page"><LoadingState>Carregando seu agendamento...</LoadingState></main>;
  if (!booking && error) return <main className="container page-content narrow-page"><ErrorState message={error} /></main>;

  return (
    <main className="container page-content narrow-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Link seguro</p>
          <h1>Seu agendamento</h1>
          <p>Este link dá acesso somente a esta reserva. Guarde-o até o atendimento acontecer.</p>
        </div>
      </header>
      <section className="panel stack-form">
        <div>
          <strong>{booking.servico_nome || "Serviço"}</strong>
          <p className="muted">{booking.negocio_nome} · {booking.profissional_nome}</p>
        </div>
        <p><strong>Quando:</strong> {formatDate(booking.data, true)} às {booking.horario}</p>
        <p><strong>Valor:</strong> {formatCurrency(booking.valor)}</p>
        <p><strong>Status:</strong> {booking.status}</p>
        {cancelUnavailable && <p className="muted">{cancelUnavailable}</p>}
        {!confirmingCancellation && error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        {canCancel && (
          <button
            className="button button-secondary"
            onClick={() => {
              setError("");
              setConfirmingCancellation(true);
            }}
            ref={cancelTriggerRef}
            type="button"
          >
            Cancelar agendamento
          </button>
        )}
        <Link className="text-link" to="/">Voltar ao Agenda Fashion</Link>
      </section>
      <GuestCancelDialog
        booking={confirmingCancellation ? booking : null}
        canceling={canceling}
        error={confirmingCancellation ? error : ""}
        onClose={closeCancellationDialog}
        onConfirm={cancelBooking}
      />
    </main>
  );
}
