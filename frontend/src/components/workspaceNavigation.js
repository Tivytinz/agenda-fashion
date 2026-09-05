const EXACT_NAVIGATION_ROUTES = new Set([
  "/painel",
  "/profissional/agenda",
  "/admin",
  "/admin/saude",
  "/admin/operacao"
]);

export function splitMobileLinks(links, primaryLimit = 4) {
  return {
    primary: links.slice(0, primaryLimit),
    secondary: links.slice(primaryLimit)
  };
}

export function isExactNavigationRoute(to) {
  return EXACT_NAVIGATION_ROUTES.has(to);
}

export function isWorkspaceRouteActive(pathname, to) {
  if (isExactNavigationRoute(to)) {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}
