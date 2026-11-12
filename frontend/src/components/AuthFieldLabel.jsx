export function AuthFieldLabel({ emoji, children }) {
  return (
    <span className="auth-field-label">
      {emoji && <span aria-hidden="true" className="auth-field-emoji">{emoji}</span>}
      <span>{children}</span>
    </span>
  );
}
