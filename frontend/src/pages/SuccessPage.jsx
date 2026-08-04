import { Link, Navigate, useLocation } from "react-router-dom";
import { formatDate, formatWhatsApp } from "../utils/format";

function localCalendarDate(date, time, additionalMinutes = 0) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);
  const instant = new Date(Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute + additionalMinutes
  ));

  return instant.toISOString().slice(0, 19).replace(/[-:]/g, "");
}

function businessAddress(business) {
  const street = [business.logradouro, business.numero]
    .filter(Boolean)
    .join(", ");

  return [
    business.endereco || street,
    business.bairro,
    business.cidade,
    business.estado
  ].filter(Boolean).join(", ");
}

function calendarUrl(booking, address) {
  const duration = Math.max(Number(booking.service.duracao_minutos) || 60, 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.service.nome} - ${booking.business.nome}`,
    dates: `${localCalendarDate(booking.date, booking.time)}/${localCalendarDate(booking.date, booking.time, duration)}`,
    details: `Agendamento feito pelo Agenda Fashion com ${booking.professional.nome}.`,
    ctz: "America/Sao_Paulo"
  });

  if (address) params.set("location", address);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function businessWhatsAppUrl(business) {
  const digits = String(
    business.whatsapp ??
    business.telefone_whatsapp ??
    business.telefone ??
    business.celular ??
    ""
  ).replace(/\D/g, "");

  if (!digits) return "";
  const phone = [10, 11].includes(digits.length) ? `55${digits}` : digits;
  return `https://wa.me/${phone}`;
}

export function SuccessPage() {
  const { state } = useLocation();

  if (!state?.booking) {
    return <Navigate to="/" replace />;
  }

  const { booking, customer } = state;
  const address = businessAddress(booking.business);
  const customerWhatsApp = formatWhatsApp(customer?.whatsapp);
  const whatsappUrl = businessWhatsAppUrl(booking.business);

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
        {(address || customerWhatsApp) && (
          <dl className="success-details">
            {address && <div><dt>Local</dt><dd>{address}</dd></div>}
            {customerWhatsApp && (
              <div><dt>WhatsApp informado</dt><dd>{customerWhatsApp}</dd></div>
            )}
          </dl>
        )}
        <div className="success-actions">
          <a
            className="button"
            href={calendarUrl(booking, address)}
            rel="noreferrer"
            target="_blank"
          >
            Adicionar ao calendário
          </a>
          {whatsappUrl && (
            <a
              className="button button-secondary"
              href={whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              Falar com o negócio
            </a>
          )}
          <Link className="button" to="/minha-agenda">Ver minha agenda</Link>
          <Link className="button button-secondary" to="/">Explorar mais serviços</Link>
        </div>
      </section>
    </main>
  );
}
