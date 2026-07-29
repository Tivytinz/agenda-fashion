import { Link, Navigate, useLocation } from "react-router-dom";
import { formatDate } from "../utils/format";

export function SuccessPage() {
  const { state } = useLocation();

  if (!state?.booking) {
    return <Navigate to="/" replace />;
  }

  const { booking } = state;

  return (
    <main className="container page-content narrow-page">
      <section className="success-card">
        <span className="success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Tudo certo</p>
        <h1>Agendamento confirmado</h1>
        <p>
          {booking.service.nome} com {booking.professional.nome},{" "}
          {formatDate(booking.date, true)} às {booking.time}.
        </p>
        <div className="success-actions">
          <Link className="button" to="/minha-agenda">Ver minha agenda</Link>
          <Link className="button button-secondary" to="/">Explorar mais serviços</Link>
        </div>
      </section>
    </main>
  );
}
