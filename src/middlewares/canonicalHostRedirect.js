const ORIGEM_CANONICA_PADRAO =
  "https://agendafashion.com.br";

const HOSTS_NAO_CANONICOS =
  new Set([
    "app.agendafashion.com.br",
    "www.agendafashion.com.br",
    "agenda-fashion-production.up.railway.app",
  ]);

function obterOrigemCanonica(
  env = process.env
) {
  const valor = String(
    env.PUBLIC_APP_URL ||
      ORIGEM_CANONICA_PADRAO
  ).trim();

  try {
    const url = new URL(valor);

    if (
      !["http:", "https:"]
        .includes(url.protocol)
    ) {
      return ORIGEM_CANONICA_PADRAO;
    }

    return url.origin;
  } catch {
    return ORIGEM_CANONICA_PADRAO;
  }
}

function aceitaHtml(req) {
  return String(
    req.headers?.accept || ""
  )
    .toLowerCase()
    .includes("text/html");
}

function deveRedirecionar(
  req,
  origemCanonica =
    obterOrigemCanonica()
) {
  const metodo =
    String(
      req.method || ""
    ).toUpperCase();

  if (
    !["GET", "HEAD"]
      .includes(metodo) ||
    !aceitaHtml(req)
  ) {
    return false;
  }

  const host =
    String(
      req.hostname || ""
    )
      .trim()
      .toLowerCase();

  if (
    !HOSTS_NAO_CANONICOS
      .has(host)
  ) {
    return false;
  }

  const hostCanonico =
    new URL(
      origemCanonica
    )
      .hostname
      .toLowerCase();

  return host !== hostCanonico;
}

function canonicalHostRedirect(
  req,
  res,
  next
) {
  const origemCanonica =
    obterOrigemCanonica();

  if (
    !deveRedirecionar(
      req,
      origemCanonica
    )
  ) {
    return next();
  }

  const original =
    String(
      req.originalUrl || "/"
    );

  const caminhoSeguro =
    original.startsWith("/") &&
    !original.startsWith("//")
      ? original
      : "/";

  return res.redirect(
    308,
    `${origemCanonica}${caminhoSeguro}`
  );
}

module.exports = canonicalHostRedirect;
module.exports.HOSTS_NAO_CANONICOS =
  HOSTS_NAO_CANONICOS;
module.exports.ORIGEM_CANONICA_PADRAO =
  ORIGEM_CANONICA_PADRAO;
module.exports.deveRedirecionar =
  deveRedirecionar;
module.exports.obterOrigemCanonica =
  obterOrigemCanonica;
