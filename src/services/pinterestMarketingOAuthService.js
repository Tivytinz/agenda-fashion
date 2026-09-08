const crypto = require("crypto");

const AppError = require("../errors/AppError");
const repository = require(
  "../repositories/pinterestMarketingOAuthRepository"
);

const AUTHORIZATION_URL = "https://www.pinterest.com/oauth/";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const API_BASE_URL = "https://api.pinterest.com/v5";
const CALLBACK_PATH =
  "/admin/marketing/custos-integracoes/pinterest_ads/callback";
const ADMIN_RESULT_PATH = "/admin/trafego-pago";
const STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_TIMEOUT_MS = 10000;
const ACCESS_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const REQUIRED_SCOPE = "ads:read";

function textoEnv(nome) {
  return String(process.env[nome] || "").trim();
}

function normalizarId(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function chaveCriptografia() {
  const segredo = textoEnv("PINTEREST_OAUTH_ENCRYPTION_KEY");
  if (segredo.length < 32) {
    throw new AppError(
      "PINTEREST_OAUTH_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.",
      500
    );
  }

  return crypto
    .createHash("sha256")
    .update(segredo, "utf8")
    .digest();
}

function scopesConfigurados() {
  const raw = textoEnv("PINTEREST_OAUTH_SCOPE") || REQUIRED_SCOPE;
  const scopes = raw
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const unicos = [...new Set(scopes)];
  const valido =
    unicos.length === 1 &&
    unicos[0] === REQUIRED_SCOPE;

  return {
    valor: unicos.join(","),
    lista: unicos,
    valido
  };
}

function validarRedirectUri(valor) {
  let redirect;
  let publicUrl;

  try {
    redirect = new URL(valor);
    publicUrl = new URL(
      textoEnv("PUBLIC_APP_URL") ||
        "https://app.agendafashion.com.br"
    );
  } catch {
    throw new AppError(
      "PINTEREST_OAUTH_REDIRECT_URI está inválida.",
      500
    );
  }

  const production = process.env.NODE_ENV === "production";
  if (
    (production && redirect.protocol !== "https:") ||
    redirect.origin !== publicUrl.origin ||
    redirect.pathname !== CALLBACK_PATH ||
    redirect.search ||
    redirect.hash
  ) {
    throw new AppError(
      "PINTEREST_OAUTH_REDIRECT_URI precisa apontar para o callback oficial do AF.",
      500
    );
  }

  return redirect.toString();
}

function config() {
  const appId = textoEnv("PINTEREST_APP_ID");
  const appSecret = textoEnv("PINTEREST_APP_SECRET");
  const adAccountId = normalizarId(
    textoEnv("PINTEREST_AD_ACCOUNT_ID")
  );
  const encryptionKey = textoEnv(
    "PINTEREST_OAUTH_ENCRYPTION_KEY"
  );
  const redirectRaw = textoEnv("PINTEREST_OAUTH_REDIRECT_URI");
  const scopes = scopesConfigurados();

  let redirectUri = "";
  let redirectValido = false;
  if (redirectRaw) {
    try {
      redirectUri = validarRedirectUri(redirectRaw);
      redirectValido = true;
    } catch {
      redirectUri = redirectRaw;
    }
  }

  return {
    appId,
    appSecret,
    adAccountId,
    encryptionKeyConfigured: encryptionKey.length >= 32,
    redirectUri,
    redirectValido,
    scope: scopes.valor,
    scopeValido: scopes.valido,
    disponivel: Boolean(
      appId &&
        appSecret &&
        adAccountId &&
        encryptionKey.length >= 32 &&
        redirectRaw &&
        redirectValido &&
        scopes.valido
    )
  };
}

function exigirConfiguracaoOAuth() {
  const atual = config();
  if (!atual.disponivel) {
    throw new AppError(
      "OAuth do Pinterest Ads ainda não está completamente configurado no backend.",
      409
    );
  }
  return atual;
}

function hashEstado(state) {
  return crypto
    .createHash("sha256")
    .update(String(state || ""), "utf8")
    .digest("hex");
}

function criptografar(valor) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    chaveCriptografia(),
    iv
  );
  const ciphertext = Buffer.concat([
    cipher.update(String(valor), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
}

function descriptografar(valor) {
  const partes = String(valor || "").split(":");
  if (partes.length !== 4 || partes[0] !== "v1") {
    throw new AppError(
      "Credencial Pinterest armazenada em formato inválido.",
      500
    );
  }

  try {
    const iv = Buffer.from(partes[1], "base64url");
    const tag = Buffer.from(partes[2], "base64url");
    const ciphertext = Buffer.from(partes[3], "base64url");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      chaveCriptografia(),
      iv
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new AppError(
      "Não foi possível ler a credencial criptografada do Pinterest Ads.",
      500
    );
  }
}

function basicAuth(atual) {
  return Buffer.from(
    `${atual.appId}:${atual.appSecret}`,
    "utf8"
  ).toString("base64");
}

async function lerJsonSeguro(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requisicaoToken(form, atual) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OAUTH_TIMEOUT_MS
  );

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basicAuth(atual)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal
    });
    const payload = await lerJsonSeguro(response);

    if (!response.ok || !payload?.access_token) {
      throw new AppError(
        "O Pinterest Ads recusou a autorização. Gere uma nova autorização e tente novamente.",
        502
      );
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError(
        "O Pinterest Ads demorou demais para concluir a autorização.",
        504
      );
    }
    throw erro;
  } finally {
    clearTimeout(timeoutId);
  }
}

function escoposToken(payload) {
  return String(payload?.scope || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function datasExpiracao(payload) {
  const agora = Date.now();
  const accessSeconds = Number(payload?.expires_in || 0);
  const refreshSeconds = Number(
    payload?.refresh_token_expires_in || 0
  );
  const refreshAt = Number(payload?.refresh_token_expires_at || 0);

  return {
    accessTokenExpiresAt:
      accessSeconds > 0
        ? new Date(agora + accessSeconds * 1000)
        : null,
    refreshTokenExpiresAt:
      refreshAt > 0
        ? new Date(refreshAt * 1000)
        : refreshSeconds > 0
          ? new Date(agora + refreshSeconds * 1000)
          : null
  };
}

async function validarContaComToken({ accessToken, adAccountId }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OAUTH_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/ad_accounts/${encodeURIComponent(adAccountId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        signal: controller.signal
      }
    );
    const payload = await lerJsonSeguro(response);
    const returnedId = normalizarId(payload?.id);

    if (!response.ok || returnedId !== adAccountId) {
      throw new AppError(
        "A autorização do Pinterest não possui acesso à conta de anúncios configurada no Agenda Fashion.",
        response.status === 401 || response.status === 403 ? 403 : 502
      );
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError(
        "O Pinterest Ads demorou demais para validar a conta autorizada.",
        504
      );
    }
    throw erro;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function statusAutorizacao() {
  const atual = config();
  const credencial = await repository.buscarCredencial();
  const mesmaConta = Boolean(
    credencial &&
      atual.adAccountId &&
      normalizarId(credencial.ad_account_id) === atual.adAccountId
  );

  return {
    disponivel: atual.disponivel,
    autorizado: mesmaConta,
    adAccountId: atual.adAccountId || null,
    autorizadoEm: mesmaConta
      ? credencial.updated_at || credencial.created_at || null
      : null
  };
}

async function iniciarAutorizacao({ usuarioId }) {
  const atual = exigirConfiguracaoOAuth();
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      "Administrador inválido para autorização do Pinterest.",
      400
    );
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);

  await repository.criarEstado({
    stateHash: hashEstado(state),
    usuarioId: id,
    expiresAt
  });

  const authorizationUrl = new URL(AUTHORIZATION_URL);
  authorizationUrl.searchParams.set("client_id", atual.appId);
  authorizationUrl.searchParams.set(
    "redirect_uri",
    atual.redirectUri
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", atual.scope);
  authorizationUrl.searchParams.set("state", state);

  return {
    authorizationUrl: authorizationUrl.toString(),
    expiresAt: expiresAt.toISOString()
  };
}

async function concluirAutorizacao({ state, code }) {
  const atual = exigirConfiguracaoOAuth();
  const stateValue = String(state || "").trim();
  const codeValue = String(code || "").trim();

  if (!stateValue || stateValue.length > 200) {
    throw new AppError(
      "State inválido no retorno do Pinterest Ads.",
      400
    );
  }

  const estado = await repository.consumirEstado({
    stateHash: hashEstado(stateValue)
  });
  if (!estado) {
    throw new AppError(
      "A autorização do Pinterest expirou, já foi utilizada ou é inválida.",
      400
    );
  }

  if (!codeValue || codeValue.length > 2000) {
    throw new AppError(
      "O Pinterest Ads não devolveu um código de autorização válido.",
      400
    );
  }

  const payload = await requisicaoToken({
    grant_type: "authorization_code",
    code: codeValue,
    redirect_uri: atual.redirectUri
  }, atual);

  const accessToken = String(payload.access_token || "").trim();
  const refreshToken = String(payload.refresh_token || "").trim();
  const scopes = escoposToken(payload);
  if (!accessToken || !refreshToken) {
    throw new AppError(
      "O Pinterest Ads respondeu sem access token ou refresh token.",
      502
    );
  }
  if (!scopes.includes(REQUIRED_SCOPE)) {
    throw new AppError(
      "A autorização do Pinterest não concedeu o escopo ads:read.",
      403
    );
  }

  await validarContaComToken({
    accessToken,
    adAccountId: atual.adAccountId
  });

  const expiracao = datasExpiracao(payload);
  const credencial = await repository.salvarCredencial({
    adAccountId: atual.adAccountId,
    accessTokenCiphertext: criptografar(accessToken),
    refreshTokenCiphertext: criptografar(refreshToken),
    scope: scopes,
    accessTokenExpiresAt: expiracao.accessTokenExpiresAt,
    refreshTokenExpiresAt: expiracao.refreshTokenExpiresAt,
    usuarioId: Number(estado.usuario_id)
  });

  return {
    autorizado: true,
    adAccountId: credencial.ad_account_id,
    autorizadoEm:
      credencial.updated_at || credencial.created_at || null
  };
}

function precisaRenovar(credencial) {
  if (!credencial?.access_token_expires_at) return true;
  const expires = new Date(
    credencial.access_token_expires_at
  ).getTime();
  return !Number.isFinite(expires) ||
    expires <= Date.now() + ACCESS_REFRESH_MARGIN_MS;
}

async function renovarCredencial(credencial, atual) {
  if (
    credencial?.refresh_token_expires_at &&
    new Date(credencial.refresh_token_expires_at).getTime() <= Date.now()
  ) {
    throw new AppError(
      "A autorização do Pinterest Ads expirou. Autorize a conta novamente.",
      409
    );
  }

  const refreshToken = descriptografar(
    credencial.refresh_token_ciphertext
  ).trim();
  if (!refreshToken) {
    throw new AppError(
      "Credencial Pinterest armazenada sem refresh token válido.",
      500
    );
  }

  const payload = await requisicaoToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: REQUIRED_SCOPE
  }, atual);

  const accessToken = String(payload.access_token || "").trim();
  const nextRefreshToken = String(
    payload.refresh_token || refreshToken
  ).trim();
  const scopes = escoposToken(payload);
  const expiracao = datasExpiracao(payload);

  if (!accessToken || !scopes.includes(REQUIRED_SCOPE)) {
    throw new AppError(
      "O Pinterest Ads devolveu uma renovação de token inválida.",
      502
    );
  }

  await repository.atualizarTokens({
    accessTokenCiphertext: criptografar(accessToken),
    refreshTokenCiphertext: criptografar(nextRefreshToken),
    scope: scopes,
    accessTokenExpiresAt: expiracao.accessTokenExpiresAt,
    refreshTokenExpiresAt:
      expiracao.refreshTokenExpiresAt ||
      credencial.refresh_token_expires_at
  });

  return accessToken;
}

async function obterAccessToken() {
  const atual = exigirConfiguracaoOAuth();
  const credencial = await repository.buscarCredencial();

  if (
    !credencial ||
    normalizarId(credencial.ad_account_id) !== atual.adAccountId
  ) {
    throw new AppError(
      "Pinterest Ads ainda não foi autorizado para a conta configurada.",
      409
    );
  }

  if (precisaRenovar(credencial)) {
    return renovarCredencial(credencial, atual);
  }

  const accessToken = descriptografar(
    credencial.access_token_ciphertext
  ).trim();
  if (!accessToken) {
    throw new AppError(
      "Credencial Pinterest armazenada sem access token válido.",
      500
    );
  }

  return accessToken;
}

function urlResultado(status) {
  const base =
    textoEnv("PUBLIC_APP_URL") ||
    "https://app.agendafashion.com.br";
  const url = new URL(ADMIN_RESULT_PATH, base);
  url.searchParams.set(
    "pinterest_oauth",
    status === "success" ? "success" : "error"
  );
  return url.toString();
}

module.exports = {
  iniciarAutorizacao,
  concluirAutorizacao,
  obterAccessToken,
  statusAutorizacao,
  urlResultado,
  config,
  hashEstado,
  criptografar,
  descriptografar,
  precisaRenovar,
  AUTHORIZATION_URL,
  TOKEN_URL,
  CALLBACK_PATH
};
