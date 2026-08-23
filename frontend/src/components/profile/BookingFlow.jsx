import { useEffect, useRef, useState } from "react";
import { PublicShareButton } from "../PublicShareButton";
import { FlowSteps } from "../FlowSteps";
import { EmptyState, ErrorState, LoadingState } from "../ScreenState";
import { formatCurrency, formatDate } from "../../utils/format";
import { serviceCategoryEmoji } from "../../utils/specialties";
import { MediaThumb } from "./MediaThumb";

function ServiceChoices({
  businessId,
  businessName,
  businessSlug,
  services,
  selectedId,
  onSelect
}) {
  if (services.length === 0) {
    return (
      <EmptyState title="Este negócio ainda está configurando os serviços">
        Volte em breve para conferir a agenda.
      </EmptyState>
    );
  }

  return (
    <div className="choice-list">
      {services.map((service) => {
        const selected = String(service.id) === selectedId;
        return (
          <article
            className={selected ? "service-choice-item selected" : "service-choice-item"}
            key={service.id}
          >
            <button
              aria-label={`Selecionar ${service.nome}`}
              aria-pressed={selected}
              className={selected ? "choice-card selected" : "choice-card"}
              onClick={() => onSelect(service.id)}
              type="button"
            >
              <MediaThumb
                src={service.foto_url ?? service.imagem_url ?? service.foto}
                alt={`Foto do serviço ${service.nome}`}
                emoji={serviceCategoryEmoji(service.categoria, service.nome)}
                className="choice-media service-choice-media"
              />
              <span className="choice-copy">
                <strong>{service.nome}</strong>
                {service.descricao && <small>{service.descricao}</small>}
                <small className="service-duration-with-emoji">
                  <span className="service-duration-emoji" aria-hidden="true">🕒</span>
                  {service.duracao_minutos} min
                </small>
              </span>
              <span className="choice-price">
                <strong>{formatCurrency(service.valor)}</strong>
                <small>{selected ? "Selecionado ✓" : "Escolher"}</small>
              </span>
            </button>
            <div className="service-share-actions">
              <PublicShareButton
                ariaLabel={`Copiar link de ${service.nome}`}
                businessId={businessId}
                businessName={businessName}
                businessSlug={businessSlug}
                className="service-share-button"
                label="Copiar link"
                mode="copy"
                serviceId={service.id}
                serviceName={service.nome}
              />
              <PublicShareButton
                ariaLabel={`Compartilhar ${service.nome}`}
                businessId={businessId}
                businessName={businessName}
                businessSlug={businessSlug}
                className="service-share-button"
                label="Compartilhar"
                serviceId={service.id}
                serviceName={service.nome}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProfessionalChoices({ professionals, selectedId, onSelect }) {
  if (professionals.length === 0) {
    return <EmptyState title="Nenhum profissional disponível" />;
  }

  return (
    <div className="choice-list compact">
      {professionals.map((person) => (
        <button
          aria-pressed={String(person.id) === selectedId}
          className={String(person.id) === selectedId ? "choice-card selected" : "choice-card"}
          key={person.id}
          onClick={() => onSelect(person.id)}
          type="button"
        >
          <MediaThumb
            src={person.foto_url ?? person.avatar_url ?? person.foto}
            alt={`Foto de ${person.nome}`}
            className="avatar professional-media"
          />
          <span><strong>{person.nome}</strong><small>Profissional</small></span>
        </button>
      ))}
    </div>
  );
}

function ScheduleChoices({
  availability,
  day,
  error,
  onRetry,
  onSelectDay,
  onSelectTime,
  scheduleMessage,
  status,
  time
}) {
  const selectedDay = availability.find((item) => item.data === day);
  const dateListRef = useRef(null);
  const [dateScroll, setDateScroll] = useState({ canGoBack: false, canGoForward: false });

  function updateDateScroll() {
    const list = dateListRef.current;
    if (!list) return;

    const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth);
    setDateScroll({
      canGoBack: list.scrollLeft > 4,
      canGoForward: list.scrollLeft < maxScroll - 4
    });
  }

  function scrollDates(direction) {
    const list = dateListRef.current;
    if (!list) return;

    const distance = Math.max(220, list.clientWidth * 0.72) * direction;

    if (typeof list.scrollBy === "function") {
      list.scrollBy({ behavior: "smooth", left: distance });
    } else {
      list.scrollLeft += distance;
      updateDateScroll();
    }
  }

  useEffect(() => {
    updateDateScroll();
    window.addEventListener("resize", updateDateScroll);

    return () => window.removeEventListener("resize", updateDateScroll);
  }, [availability]);

  if (status === "loading") return <LoadingState>Buscando horários...</LoadingState>;
  if (status === "error") return <ErrorState message={error} onRetry={onRetry} />;
  if (status !== "ready") return null;

  if (availability.length === 0) {
    return (
      <EmptyState
        title="Nenhum horário disponível agora"
        action={(
          <button className="button button-secondary button-small" onClick={onRetry} type="button">
            Atualizar horários
          </button>
        )}
      >
        {scheduleMessage || "A profissional pode abrir novos horários em breve."}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="date-carousel">
        <button
          aria-label="Ver datas anteriores"
          className="date-scroll-button"
          disabled={!dateScroll.canGoBack}
          onClick={() => scrollDates(-1)}
          type="button"
        >
          ‹
        </button>
        <div className="date-list" onScroll={updateDateScroll} ref={dateListRef}>
          {availability.map((item) => (
            <button
              aria-pressed={item.data === day}
              className={item.data === day ? "date-button selected" : "date-button"}
              key={item.data}
              onClick={() => onSelectDay(item.data)}
              type="button"
            >
              {formatDate(item.data)}
            </button>
          ))}
        </div>
        <button
          aria-label="Ver próximas datas"
          className="date-scroll-button"
          disabled={!dateScroll.canGoForward}
          onClick={() => scrollDates(1)}
          type="button"
        >
          ›
        </button>
      </div>
      {selectedDay && (
        <div className="time-list" aria-label="Horários disponíveis">
          {selectedDay.horarios.map((hour) => (
            <button
              aria-pressed={hour === time}
              className={hour === time ? "time-button selected" : "time-button"}
              key={hour}
              onClick={() => onSelectTime(hour)}
              type="button"
            >
              {hour === time && <span className="time-selected-check" aria-hidden="true">✓</span>}
              <span>{hour}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function BookingSummary({ day, onContinue, professional, service, time }) {
  return (
    <aside className={
      time
        ? "booking-summary booking-summary-ready"
        : "booking-summary"
    }>
      <p className="eyebrow">Seu agendamento</p>
      <h2>Resumo</h2>
      <dl>
        <div><dt>Serviço</dt><dd>{service?.nome || "Selecione um serviço"}</dd></div>
        <div><dt>Profissional</dt><dd>{professional?.nome || "Aguardando serviço"}</dd></div>
        <div><dt>Data</dt><dd>{day ? formatDate(day, true) : "Aguardando horário"}</dd></div>
        <div><dt>Horário</dt><dd>{time || "Aguardando horário"}</dd></div>
        <div><dt>Total</dt><dd>{service ? formatCurrency(service.valor) : "Aguardando serviço"}</dd></div>
      </dl>
      <button className="button button-full" disabled={!time} onClick={onContinue}>
        {time ? "Revisar e confirmar" : "Selecione um horário"}
      </button>
      <small>Você confirma seus dados na próxima etapa.</small>
    </aside>
  );
}

export function BookingFlow({
  availability,
  businessId,
  businessName,
  businessSlug,
  day,
  error,
  onContinue,
  onRetrySchedule,
  onSelectDay,
  onSelectProfessional,
  onSelectService,
  onSelectTime,
  professionalId,
  professionals,
  scheduleMessage,
  scheduleStatus,
  selectedProfessional,
  selectedService,
  serviceId,
  services,
  time
}) {
  const hasSingleProfessional = professionals.length === 1;
  const showProfessionalStep = !hasSingleProfessional;
  const steps = showProfessionalStep
    ? ["Serviço", "Profissional", "Horário", "Confirmar"]
    : ["Serviço", "Horário", "Confirmar"];
  const currentStep = !serviceId
    ? 1
    : showProfessionalStep && !professionalId
      ? 2
      : !time
        ? showProfessionalStep ? 3 : 2
        : showProfessionalStep ? 4 : 3;
  const scheduleStep = showProfessionalStep ? 3 : 2;
  const [editingService, setEditingService] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState(false);

  function selectService(id) {
    setEditingService(false);
    onSelectService(id);
  }

  function selectProfessional(id) {
    setEditingProfessional(false);
    onSelectProfessional(id);
  }

  return (
    <>
      <FlowSteps current={currentStep} steps={steps} />
      <div className={serviceId
        ? "booking-layout booking-layout-with-summary"
        : "booking-layout"}
      >
        <div className="booking-main">
          <section className="booking-section">
            <div className="section-heading"><div><p className="step-label">1</p><h2>Escolha o serviço</h2></div></div>
            {serviceId && !editingService ? (
              <div className="booking-step-summary">
                <span>
                  <strong>{selectedService?.nome}</strong>
                  <small>{formatCurrency(selectedService?.valor)}</small>
                </span>
                <button className="text-button" onClick={() => setEditingService(true)} type="button">Alterar</button>
              </div>
            ) : (
              <ServiceChoices
                businessId={businessId}
                businessName={businessName}
                businessSlug={businessSlug}
                services={services}
                selectedId={serviceId}
                onSelect={selectService}
              />
            )}
          </section>
          {serviceId && showProfessionalStep && (
            <section className="booking-section" id="profissional">
              <div className="section-heading"><div><p className="step-label">2</p><h2>Escolha quem vai atender</h2></div></div>
              {professionalId && !editingProfessional ? (
                <div className="booking-step-summary">
                  <span><strong>{selectedProfessional?.nome}</strong><small>Profissional selecionada</small></span>
                  {professionals.length > 1 && (
                    <button className="text-button" onClick={() => setEditingProfessional(true)} type="button">Alterar</button>
                  )}
                </div>
              ) : (
                <ProfessionalChoices
                  professionals={professionals}
                  selectedId={professionalId}
                  onSelect={selectProfessional}
                />
              )}
            </section>
          )}
          {professionalId && (
            <section className="booking-section" id="horario">
              <div className="section-heading"><div><p className="step-label">{scheduleStep}</p><h2>Escolha o horário</h2></div></div>
              <ScheduleChoices
                availability={availability}
                day={day}
                error={error}
                onRetry={onRetrySchedule}
                onSelectDay={onSelectDay}
                onSelectTime={onSelectTime}
                scheduleMessage={scheduleMessage}
                status={scheduleStatus}
                time={time}
              />
            </section>
          )}
        </div>
        {serviceId && (
          <BookingSummary
            day={day}
            onContinue={onContinue}
            professional={selectedProfessional}
            service={selectedService}
            time={time}
          />
        )}
      </div>
    </>
  );
}
