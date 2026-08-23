export function ConfirmationIcon({ className = "" }) {
  const classes = ["confirmation-icon", className].filter(Boolean).join(" ");

  return (
    <svg
      aria-hidden="true"
      className={classes}
      viewBox="0 0 24 24"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" fill="#22c55e" />
      <path
        d="M7.4 12.4 10.4 15.4 16.8 8.8"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
