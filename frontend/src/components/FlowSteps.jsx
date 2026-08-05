const DEFAULT_STEPS = ["Serviço", "Profissional", "Horário", "Confirmar"];

export function FlowSteps({ current, steps = DEFAULT_STEPS }) {
  return (
    <div className="flow-progress">
      <p>
        Etapa {current} de {steps.length}
        <strong>{steps[current - 1]}</strong>
      </p>
      <ol
        className="flow-steps"
        aria-label="Etapas do agendamento"
        style={{ "--flow-step-count": steps.length }}
      >
        {steps.map((label, index) => {
          const step = index + 1;
          const state = step < current ? "done" : step === current ? "current" : "";

          return (
            <li className={state} key={label} aria-current={step === current ? "step" : undefined}>
              <span>{step}</span>
              <small>{label}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
