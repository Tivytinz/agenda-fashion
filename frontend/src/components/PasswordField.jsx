import { useState } from "react";
import { AuthFieldLabel } from "./AuthFieldLabel";

export function PasswordField({
  id,
  label,
  emoji,
  value,
  onChange,
  onBlur,
  autoComplete,
  minLength,
  describedBy
}) {
  const [visible, setVisible] = useState(false);
  const action = visible ? "Ocultar" : "Mostrar";
  const name = label === "Senha" ? "senha" : "confirmação da senha";

  return (
    <div className="auth-password-field">
      <label htmlFor={id}>
        <AuthFieldLabel emoji={emoji}>{label}</AuthFieldLabel>
      </label>
      <div className="auth-password-input-wrap">
        <input
          aria-label={label}
          aria-describedby={describedBy}
          autoComplete={autoComplete}
          id={id}
          minLength={minLength}
          onChange={onChange}
          onBlur={onBlur}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={action + " " + name}
          aria-pressed={visible}
          className="auth-password-toggle"
          onClick={() => setVisible(current => !current)}
          type="button"
        >
          <span aria-hidden="true">{visible ? "🐵" : "🙈"}</span>
        </button>
      </div>
    </div>
  );
}
