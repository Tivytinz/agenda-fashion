const crypto = require("crypto");

const AppError = require("../errors/AppError");
const repository = require(
  "../repositories/tiktokMarketingOAuthRepository"
);

const AUTHORIZATION_URL =
  "https://ads.tiktok.com/marketing_api/auth";
const TOKEN_URL =
  "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
const CALLBACK_PATH =
  "/admin/marketing/custos-integracoes/tiktok_ads/callback";
const ADMIN_RESULT_PATH = "/admin/trafego-pago";
const STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_TIMEOUT_MS = 10000;

function textoEnv(nome) {
  return String(process.env[nome] || "").trim();
}

function normalizarId(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function chaveCriptografia() {
  const segredo = textoEnv("TIKTOK_OAUTH_ENCRYPTION_KEY");
  if (segredo.length < 32) {
    throw new AppError(
      "TIKTOK_OAUTH_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.",
      500
    );
  }

  return crypto
    .createHash("sha256")
    .update(segredo, "utf8")
    .digest();
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
      "TIKTOK_OAUTH_REDIRECT_URI está inválida.",
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
      "TIKTOK_OAUTH_REDIRECT_URI precisa apontar para o callback oficial do AF.",
      500
    );
  }

  return redirect.toString();
}

function config() {
  const appId = textoEnv("TIKTOK_APP_ID");
  const appSecret = textoEnv("TIKTOK_APP_SECRET");
  const advertiserId = normalizarId(
    textoEnv("TIKTOK_ADVERTISER_ID")
  );
  const encryptionKey = textoEnv(
    "TIKTOK_OAUTH_ENCRYPTION_KEY"
  );
  const redirectRaw = textoEnv("TIKTOK_OAUTH_REDIRECT_URI");
  const scope = textoEnv("TIKTOK_OAUTH_SCOPE");

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
    advertiserId,
    encryptionKeyConfigured: encryptionKey.length >= 32,
    redirectUri,
    redirectValido,
    scope,
    disponivel: Boolean(
      appId &&
        appSecret &&
        advertiserId &&
        encryptionKey.length >= 32 &&
        redirectRaw &&
        redirectValido
    )
  };
}

function exigirConfiguracaoOAuth() {
  const atual = config();
  if (!atual.disponivel) {
    throw new AppError(
      "OAuth do TikTok Ads ainda não está completamente configurado no backend.",
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
      "Credencial TikTok armazenada em formato inválido.",
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
      "Não foi possível ler a credencial criptografada do TikTok Ads.",
      500
    );
  }
}

async function statusAutorizacao() {
  const atual = config();
  const credencial = await repository.buscarCredencial();
  const mesmoAdvertiser = Boolean(
    credencial &&
      atual.advertiserId &&
      normalizarId(credencial.advertiser_id) === atual.advertiserId
  );

  return {
    disponivel: atual.disponivel,
    autorizado: mesmoAdvertiser,
    advertiserId: atual.advertiserId || null,
    autorizadoEm: mesmoAdvertiser
      ? credencial.updated_at || credencial.created_at || null
      : null
  };
}

async function iniciarAutorizacao({ usuarioId }) {
  const atual = exigirConfiguracaoOAuth();
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Administrador inválido para autorização do TikTok.", 400);
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);

  await repository.criarEstado({
    stateHash: hashEstado(state),
    usuarioId: id,
    expiresAt
  });

  const authorizationUrl = new URL(AUTHORIZATION_URL);
  authorizationUrl.searchParams.set("app_id", atual.appId);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("redirect_uri", atual.redirectUri);
  if (atual.scope) {
    authorizationUrl.searchParams.set("scope", atual.scope);
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    expiresAt: expiresAt.toISOString()
  };
}

async function lerJsonSeguro(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function trocarCodigoPorToken({ authCode, atual }) {
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: atual.appId,
        secret: atual.appSecret,
        auth_code: authCode
      }),
      signal: controller.signal
    });
    const payload = await lerJsonSeguro(response);

    if (!response.ok || Number(payload?.code) !== 0) {
      throw new AppError(
        "O TikTok Ads recusou a autorização. Gere uma nova autorização e tente novamente.",
        502
      );
    }

    const accessToken = String(
      payload?.data?.access_token || ""
    ).trim();
    const advertiserIds = Array.isArray(payload?.data?.advertiser_ids)
      ? payload.data.advertiser_ids
          .map(normalizarId)
          .filter(Boolean)
      : [];
    const scope = Array.isArray(payload?.data?.scope)
      ? payload.data.scope
      : [];

    if (!accessToken) {
      throw new AppError(
        "O TikTok Ads respondeu sem access token.",
        502
      );
    }

    if (!advertiserIds.includes(atual.advertiserId)) {
      throw new AppError(
        "A autorização não possui acesso ao Advertiser ID configurado no Agenda Fashion.",
        403
      );
    }

    return {
      accessToken,
      advertiserIds,
      scope
    };
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError(
        "O TikTok Ads demorou demais para concluir a autorização.",
        504
      );
    }
    throw erro;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function concluirAutorizacao({ state, authCode }) {
  const atual = exigirConfiguracaoOAuth();
  const stateValue = String(state || "").trim();
  const codeValue = String(authCode || "").trim();

  if (!stateValue || stateValue.length > 200) {
    throw new AppError("State inválido no retorno do TikTok Ads.", 400);
  }

  const estado = await repository.consumirEstado({
    stateHash: hashEstado(stateValue)
  });
  if (!estado) {
    throw new AppError(
      "A autorização do TikTok expirou, já foi utilizada ou é inválida.",
      400
    );
  }

  if (!codeValue || codeValue.length > 1000) {
    throw new AppError(
      "O TikTok Ads não devolveu um código de autorização válido.",
      400
    );
  }

  const token = await trocarCodigoPorToken({
    authCode: codeValue,
    atual
  });

  const credencial = await repository.salvarCredencial({
    advertiserId: atual.advertiserId,
    accessTokenCiphertext: criptografar(token.accessToken),
    scope: token.scope,
    authorizedAdvertiserIds: token.advertiserIds,
    usuarioId: Number(estado.usuario_id)
  });

  return {
    autorizado: true,
    advertiserId: credencial.advertiser_id,
    autorizadoEm: credencial.updated_at || credencial.created_at || null
  };
}

async function obterAccessToken() {
  const atual = exigirConfiguracaoOAuth();
  const credencial = await repository.buscarCredencial();

  if (
    !credencial ||
    normalizarId(credencial.advertiser_id) !== atual.advertiserId
  ) {
    throw new AppError(
      "TikTok Ads ainda não foi autorizado para a conta configurada.",
      409
    );
  }

  const accessToken = descriptografar(
    credencial.access_token_ciphertext
  ).trim();
  if (!accessToken) {
    throw new AppError(
      "Credencial TikTok armazenada sem access token válido.",
      500
    );
  }

  return accessToken;
}

function urlResultado(status) {
  const base = textoEnv("PUBLIC_APP_URL") ||
    "https://app.agendafashion.com.br";
  const url = new URL(ADMIN_RESULT_PATH, base);
  url.searchParams.set(
    "tiktok_oauth",
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
  AUTHORIZATION_URL,
  TOKEN_URL,
  CALLBACK_PATH
};
