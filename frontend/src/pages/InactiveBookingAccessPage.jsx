import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";

const ACTIVE_STATUSES = new Set(["agendado", "confirmado"]);

export function InactiveBookingAccessPage() {
  const { id } = useParams();
  const location = useLocation();
  const hashParams = new URLSearchParams(
    String(location.hash || "").replace(/^#/, "")
  );
  const token = hashParams.get("token") || "";
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(
      `/agendamentos/${id}/acesso-cliente-desativado`,
      {
        headers: {
          "X-Agenda-Access": token
        }
      }
    )
      .then((result) => {
        if (active) setBooking(result.agendamento || null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, token]);

  async function cancelBooking() {
    if (
      !window.confirm(
        "Cancelar este agendamento? Essa ação não pode ser desfeita."
      )
    ) {
      return;
    }

    setCanceling(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/agendamentos/${id}/cancelar-acesso-cliente-desativado`,
        {
          method: "PATCH",
          body: { token }
        }
      );
      setBooking((current) => ({
        ...current,
        ...(result.agendamento || {}),
        status: result.agendamento?.status || "cancelado"
      }));
      setMessage(result.mensagem || "Agendamento cancelado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <main className="container page-content narrow-page">
        <LoadingState>Carregando seu agendamento...</LoadingState>
      </main>
    );
  }

  if (!booking && error) {
    return (
      <main className="container page-content narrow-page">
        <ErrorState message={error} />
      </main>
    );
  }

  const canCancel = ACTIVE_STATUSES.has(booking?.status);

  return (
    <main className="container page-content narrow-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Acesso seguro</p>
          <h1>Seu agendamento</h1>
          <p>
            Este acesso continua disponível porque sua conta foi desativada.
          </p>
        </div>
      </header>

      <section className="panel stack-form">
        <div>
          <strong>{booking.servico_nome || "Serviço"}</strong>
          <p className="muted">
            {booking.negocio_nome} · {booking.profissional_nome}
          </p>
        </div>
        <p>
          <strong>Data:</strong> {booking.data} às {booking.horario}
        </p>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}

        {canCancel && (
          <button
            className="button button-secondary"
            disabled={canceling}
            onClick={cancelBooking}
            type="button"
          >
            {canceling ? "Cancelando..." : "Cancelar agendamento"}
          </button>
        )}

        <Link className="text-link" to="/">
          Voltar ao Agenda Fashion
        </Link>
      </section>
    </main>
  );
}
