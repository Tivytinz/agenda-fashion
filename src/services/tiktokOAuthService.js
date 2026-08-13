const crypto = require("crypto");

const AppError = require("../errors/AppError");
const repository = require("../repositories/tiktokOAuthRepository");

const AUTH_URL = "https://business-api.tiktok.com/portal/auth";
const API_BASE = "https://business-api.tiktok.com/open_api";
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let refreshEmAndamento = null;

function texto(valor) {
  return String(valor || "").trim();
}

function somenteDigitos(valor) {
  return texto(valor).replace(/\D/g, "");
}

function timeoutMs() {
  const valor = Number(process.env.MARKETING_COST_SYNC_TIMEOUT_MS || 10000);
  return Number.isFinite(valor) && valor >= 1000 && valor <= 30000
    ? Math.trunc(valor)
    : 10000;
}

function configuracao() {
  const publicOrigin = texto(process.env.PUBLIC_APP_URL) ||
    "https://app.agendafashion.com.br";
  const redirectUri = texto(process.env.TIKTOK_OAUTH_REDIRECT_URI) ||
    `${publicOrigin.replace(/\/$/, "")}/admin/trafego-pago/custos`;

  return {
    appId: texto(process.env.TIKTOK_APP_ID),
    appSecret: texto(process.env.TIKTOK_APP_SECRET),
    advertiserId: somenteDigitos(process.env.TIKTOK_ADVERTISER_ID),
    encryptionSecret: texto(process.env.TIKTOK_OAUTH_ENCRYPTION_KEY),
    version: texto(process.env.TIKTOK_API_VERSION) || "v1.3",
    redirectUri,
    publicOrigin
  };
}

function validarRedirect(config) {
  let redirect;
  let publicUrl;

  try {
    redirect = new URL(config.redirectUri);
    publicUrl = new URL(config.publicOrigin);
  } catch {
    throw new AppError("A URL de retorno do TikTok está inválida.", 500);
  }

  if (
    redirect.protocol !== "https:" ||
    redirect.origin !== publicUrl.origin ||
    redirect.pathname !== "/admin/trafego-pago/custos" ||
    redirect.username ||
    redirect.password ||
    redirect.hash
  ) {
    throw new AppError(
      "A URL de retorno do TikTok deve apontar para a rota administrativa oficial do AF.",
      500
    );
  }

  return redirect.toString();
}

function validarConfiguracaoOAuth() {
  const config = configuracao();
  const ausentes = [];

  if (!config.appId) ausentes.push("TIKTOK_APP_ID");
  if (!config.appSecret) ausentes.push("TIKTOK_APP_SECRET");
  if (!config.advertiserId) ausentes.push("TIKTOK_ADVERTISER_ID");
  if (!config.encryptionSecret || config.encryptionSecret.length < 32) {
    ausentes.push("TIKTOK_OAUTH_ENCRYPTION_KEY");
  }

  if (ausentes.length > 0) {
    throw new AppError(
      `OAuth TikTok incompleto no ambiente: ${ausentes.join(", ")}.`,
      409
    );
  }

  config.redirectUri = validarRedirect(config);
  return config;
}

function configuracaoOAuthDisponivel() {
  try {
    validarConfiguracaoOAuth();
    return true;
  } catch {
    return false;
  }
}

function hashState(state) {
  return crypto
    .createHash("sha256")
    .update(String(state || ""), "utf8")
    .digest("hex");
}

function chaveCriptografia() {
  const segredo = configuracao().encryptionSecret;
  if (!segredo || segredo.length < 32) {
    throw new AppError(
      "TIKTOK_OAUTH_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.",
      500
    );
  }

  return crypto.createHash("sha256").update(segredo, "utf8").digest();
}

function criptografar(valor) {
  const textoPlano = texto(valor);
  if (!textoPlano) {
    throw new AppError("O TikTok não devolveu uma credencial válida.", 502);
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chaveCriptografia(), iv);
  const encrypted = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

function descriptografar(valor) {
  const partes = texto(valor).split(":");
  if (partes.length !== 4 || partes[0] !== "v1") {
    throw new AppError("Credencial TikTok armazenada em formato inválido.", 500);
  }

  try {
    const iv = Buffer.from(partes[1], "base64url");
    const tag = Buffer.from(partes[2], "base64url");
    const encrypted = Buffer.from(partes[3], "base64url");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      chaveCriptografia(),
      iv
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new AppError("Não foi possível abrir a credencial TikTok armazenada.", 500);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || Number(payload?.code ?? 0) !== 0) {
      const detalhe = texto(payload?.message) || `HTTP ${response.status}`;
      throw new AppError(`TikTok recusou a autorização: ${detalhe}`, 502);
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError("O TikTok excedeu o tempo de resposta.", 504);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

function tokenEndpoint(config, endpoint) {
  return `${API_BASE}/${config.version}/tt_user/oauth2/${endpoint}/`;
}

async function trocarCodigoPorToken(config, authCode, redirectUri) {
  return fetchJson(tokenEndpoint(config, "token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      auth_code: authCode,
      redirect_uri: redirectUri
    })
  });
}

async function renovarToken(config, refreshToken) {
  return fetchJson(tokenEndpoint(config, "refresh_token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
}

async function validarAdvertiser(config, accessToken) {
  const url = new URL(
    `${API_BASE}/${config.version}/advertiser/info/`
  );
  url.searchParams.set(
    "advertiser_ids",
    JSON.stringify([config.advertiserId])
  );

  const payload = await fetchJson(url.toString(), {
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json"
    }
  });
  const lista = Array.isArray(payload?.data?.list)
    ? payload.data.list
    : [];
  const conta = lista.find(
    (item) => somenteDigitos(item?.advertiser_id || item?.id) === config.advertiserId
  );

  if (!conta) {
    throw new AppError(
      "A autorização TikTok não dá acesso ao Advertiser ID configurado no AF.",
      403
    );
  }

  return conta;
}

function segundosPositivos(valor, fallback) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0
    ? Math.trunc(numero)
    : fallback;
}

async function persistirPayloadToken({
  config,
  payload,
  usuarioId,
  validarConta = true
}) {
  const data = payload?.data || {};
  const accessToken = texto(data.access_token);
  const refreshToken = texto(data.refresh_token);

  if (!accessToken || !refreshToken) {
    throw new AppError("TikTok não devolveu access token e refresh token válidos.", 502);
  }

  if (validarConta) {
    await validarAdvertiser(config, accessToken);
  }

  const agora = Date.now();
  const accessExpiresSeconds = segundosPositivos(data.expires_in, 86400);
  const refreshExpiresSeconds = segundosPositivos(
    data.refresh_token_expires_in,
    31536000
  );

  await repository.salvarCredencial({
    advertiserId: config.advertiserId,
    accessTokenEncrypted: criptografar(accessToken),
    refreshTokenEncrypted: criptografar(refreshToken),
    accessTokenExpiresAt: new Date(agora + accessExpiresSeconds * 1000),
    refreshTokenExpiresAt: new Date(agora + refreshExpiresSeconds * 1000),
    scope: texto(data.scope) || null,
    openId: texto(data.open_id) || null,
    usuarioId: Number.isInteger(Number(usuarioId)) ? Number(usuarioId) : null
  });

  process.env.TIKTOK_ADS_ACCESS_TOKEN = accessToken;
  return accessToken;
}

async function iniciarAutorizacao({ usuarioId }) {
  const config = validarConfiguracaoOAuth();
  const idUsuario = Number(usuarioId);
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new AppError("Administrador inválido para iniciar a autorização TikTok.", 401);
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);

  await repository.limparEstadosExpirados();
  await repository.salvarEstado({
    stateHash: hashState(state),
    usuarioId: idUsuario,
    redirectUri: config.redirectUri,
    expiresAt
  });

  const url = new URL(AUTH_URL);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);

  return {
    url: url.toString(),
    expiresAt: expiresAt.toISOString()
  };
}

async function finalizarAutorizacao({ authCode, state }) {
  const config = validarConfiguracaoOAuth();
  const code = texto(authCode);
  const rawState = texto(state);

  if (!code || !rawState) {
    throw new AppError("Retorno de autorização TikTok incompleto.", 400);
  }

  const stateSalvo = await repository.consumirEstado(hashState(rawState));
  if (!stateSalvo) {
    throw new AppError("A autorização TikTok expirou ou já foi utilizada.", 400);
  }

  if (stateSalvo.redirect_uri !== config.redirectUri) {
    throw new AppError("A URL de retorno do TikTok não corresponde à autorização iniciada.", 400);
  }

  const payload = await trocarCodigoPorToken(
    config,
    code,
    stateSalvo.redirect_uri
  );

  await persistirPayloadToken({
    config,
    payload,
    usuarioId: stateSalvo.usuario_id
  });

  return {
    autorizado: true,
    advertiserId: config.advertiserId
  };
}

async function renovarCredencial(credencial) {
  const config = validarConfiguracaoOAuth();
  const refreshExpiresAt = new Date(credencial.refresh_token_expires_at).getTime();

  if (!Number.isFinite(refreshExpiresAt) || refreshExpiresAt <= Date.now()) {
    throw new AppError("A autorização TikTok expirou. Autorize a conta novamente.", 409);
  }

  if (somenteDigitos(credencial.advertiser_id) !== config.advertiserId) {
    throw new AppError("O Advertiser ID salvo não corresponde ao configurado no ambiente.", 409);
  }

  const refreshToken = descriptografar(credencial.refresh_token_encrypted);
  const payload = await renovarToken(config, refreshToken);

  return persistirPayloadToken({
    config,
    payload,
    usuarioId: credencial.autorizado_por_usuario_id
  });
}

async function obterAccessTokenValido() {
  const manual = texto(process.env.TIKTOK_ADS_ACCESS_TOKEN);
  const credencial = await repository.buscarCredencial();

  if (!credencial) {
    if (manual) return manual;
    throw new AppError("Autorize a conta TikTok Ads no painel antes de continuar.", 409);
  }

  const config = validarConfiguracaoOAuth();
  if (somenteDigitos(credencial.advertiser_id) !== config.advertiserId) {
    throw new AppError("A conta TikTok autorizada não corresponde ao Advertiser ID configurado.", 409);
  }

  const accessExpiresAt = new Date(credencial.access_token_expires_at).getTime();
  if (
    Number.isFinite(accessExpiresAt) &&
    accessExpiresAt > Date.now() + REFRESH_MARGIN_MS
  ) {
    const token = descriptografar(credencial.access_token_encrypted);
    process.env.TIKTOK_ADS_ACCESS_TOKEN = token;
    return token;
  }

  if (!refreshEmAndamento) {
    refreshEmAndamento = renovarCredencial(credencial)
      .finally(() => {
        refreshEmAndamento = null;
      });
  }

  return refreshEmAndamento;
}

async function statusAutorizacao() {
  const configDisponivel = configuracaoOAuthDisponivel();
  const manual = texto(process.env.TIKTOK_ADS_ACCESS_TOKEN);
  const credencial = await repository.buscarCredencial();

  if (!credencial) {
    return {
      disponivel: configDisponivel,
      autorizado: Boolean(manual),
      fonte: manual ? "manual" : null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null
    };
  }

  const advertiserId = somenteDigitos(configuracao().advertiserId);
  const refreshExpiresAt = new Date(credencial.refresh_token_expires_at);
  const refreshValido =
    !Number.isNaN(refreshExpiresAt.getTime()) &&
    refreshExpiresAt.getTime() > Date.now();

  return {
    disponivel: configDisponivel,
    autorizado:
      configDisponivel &&
      refreshValido &&
      somenteDigitos(credencial.advertiser_id) === advertiserId,
    fonte: "oauth",
    accessTokenExpiresAt: credencial.access_token_expires_at || null,
    refreshTokenExpiresAt: credencial.refresh_token_expires_at || null
  };
}

module.exports = {
  iniciarAutorizacao,
  finalizarAutorizacao,
  obterAccessTokenValido,
  statusAutorizacao,
  configuracaoOAuthDisponivel,
  validarConfiguracaoOAuth,
  hashState,
  criptografar,
  descriptografar,
  validarAdvertiser
};
