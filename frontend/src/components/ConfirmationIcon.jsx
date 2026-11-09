export function ConfirmationIcon({ className = "" }) {
  const classes = ["confirmation-icon", "native-emoji", className].filter(Boolean).join(" ");
  return <span aria-hidden="true" className={classes}>✅</span>;
}
