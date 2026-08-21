const ICON_PATHS = {
  account: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  brand: (
    <>
      <path d="M9 3h6v4H9z" />
      <path d="M7 8h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <path d="m18.5 3 .4 1.1L20 4.5l-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z" />
    </>
  ),
  business: (
    <>
      <path d="M4 10h16l-2-5H6z" />
      <path d="M5 10v9h14v-9M9 19v-5h6v5" />
      <path d="M4 10a3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  costs: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 .8-3 2s1.2 1.8 3 2.2 3 1 3 2.3-1.3 2.5-3 2.5c-1.2 0-2.4-.4-3.2-1.2M12 5.5v13" />
    </>
  ),
  funnel: (
    <path d="M4 5h16l-6 7v5l-4 2v-7z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  health: (
    <>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
      <path d="M19.5 5.5a4.2 4.2 0 0 0-6 0L12 7l-1.5-1.5a4.2 4.2 0 0 0-6 6L12 19l7.5-7.5a4.2 4.2 0 0 0 0-6z" opacity=".35" />
    </>
  ),
  marketing: (
    <>
      <path d="M4 17 10 11l4 4 6-8" />
      <path d="M15 7h5v5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  services: (
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2" />
      <path d="M3 20a6 6 0 0 1 12 0M15 15a4 4 0 0 1 6 3.5" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20 11.5a8 8 0 0 1-11.8 7l-4.2 1 1.1-4A8 8 0 1 1 20 11.5z" />
      <path d="M8.2 8.1c.5 3 2.5 5 5.6 5.8l1.2-1.2" />
    </>
  )
};

export function AppIcon({ className = "", name }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {ICON_PATHS[name] || ICON_PATHS.services}
    </svg>
  );
}
