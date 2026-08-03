export function LoadingState({ children = "Carregando..." }) {
  return <div className="screen-state" role="status"><span aria-hidden="true" className="spinner" />{children}</div>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="screen-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="screen-state error-state" role="alert">
      <strong>Algo não saiu como esperado</strong>
      <p>{message}</p>
      {onRetry && <button className="button button-secondary" onClick={onRetry} type="button">Tentar novamente</button>}
    </div>
  );
}
