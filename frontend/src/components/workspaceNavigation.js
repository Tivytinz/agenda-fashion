export function splitMobileLinks(links, primaryLimit = 4) {
  return {
    primary: links.slice(0, primaryLimit),
    secondary: links.slice(primaryLimit)
  };
}

export function isWorkspaceRouteActive(pathname, to) {
  if (to === "/painel" || to === "/profissional/agenda") {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}
