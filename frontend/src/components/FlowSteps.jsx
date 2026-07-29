const STEPS = ["Serviço", "Profissional", "Horário", "Confirmar"];

export function FlowSteps({ current }) {
  return (
    <div className="flow-progress">
      <p>
        Etapa {current} de {STEPS.length}
        <strong>{STEPS[current - 1]}</strong>
      </p>
      <ol className="flow-steps" aria-label="Etapas do agendamento">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const state = step < current ? "done" : step === current ? "current" : "";

          return (
            <li className={state} key={label} aria-current={step === current ? "step" : undefined}>
              <span>{step < current ? "✓" : step}</span>
              <small>{label}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
