import { createServer, request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

// Cookies são entregues por HTTP real; a UI e seus módulos continuam no Vite.
// Assim a verificação inclui o transporte de cookies HttpOnly pelo navegador.
async function sessionServer(baseURL, handleApi) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, baseURL).pathname;
    const isApi = String(req.headers.accept || "").includes("application/json")
      || ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    if (isApi) {
      req.resume();
      Promise.resolve(handleApi(req, res, path)).catch(error => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ erro: error.message }));
      });
      return;
    }
    const upstreamUrl = new URL(baseURL);
    upstreamUrl.pathname = path;
    upstreamUrl.search = new URL(req.url, baseURL).search;
    const upstream = httpRequest(upstreamUrl, {
      method: req.method,
      headers: { ...req.headers, host: new URL(baseURL).host }
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

function json(res, body, cookie) {
  res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) });
  res.end(JSON.stringify(body));
}

test("Sair durante um login aguarda o cookie novo e revoga essa sessão", async ({ page, context, baseURL }) => {
  let finishLogin;
  const gate = new Promise(resolve => { finishLogin = resolve; });
  const events = [];
  const logoutCookies = [];
  const server = await sessionServer(baseURL, async (req, res, path) => {
    if (path === "/login") {
      events.push("login:start");
      await gate;
      events.push("login:response");
      return json(res, { usuario: { id: 2, nome: "Bruna" } }, "af_session=nova; Path=/; HttpOnly; SameSite=Lax");
    }
    if (path === "/logout") {
      logoutCookies.push(req.headers.cookie);
      events.push("logout:nova");
      res.writeHead(204, { "Set-Cookie": "af_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax" });
      return res.end();
    }
    return json(res, { usuario: { id: 1, nome: "Ana" }, vinculos: [] });
  });
  await context.addCookies([{ name: "af_session", value: "anterior", url: server.origin }]);
  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  try {
    await page.goto(`${server.origin}/e2e/fixtures/session-transitions.html`);
    await expect(page.getByTestId("session")).toHaveText("Ana");
    await page.getByRole("button", { name: "Autenticar" }).click();
    await expect.poll(() => events).toEqual(["login:start"]);
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page.getByTestId("session")).toHaveText("Desconectada");
    expect(events).toEqual(["login:start"]);
    finishLogin();
    await expect.poll(() => events).toEqual(["login:start", "login:response", "logout:nova"]);
    expect(logoutCookies).toHaveLength(1);
    expect(logoutCookies[0]).toContain("af_session=nova");
    await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name === "af_session")).toBe(false);
    await expect(page.getByTestId("session")).toHaveText("Desconectada");
    expect(await page.evaluate(() => localStorage.getItem("session_active"))).toBeNull();
  } finally { finishLogin(); await server.close(); }
});

test("formulário de acesso aguarda a consulta inicial de sessão", async ({ page }) => {
  let finishSession;
  const gate = new Promise(resolve => { finishSession = resolve; });
  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  await page.route("**/minha-sessao", async route => {
    await gate;
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ erro: "Sessão expirada" }) });
  });
  try {
    await page.goto("/entrar");
    await expect(page.getByText("Carregando sua conta...")).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveCount(0);
    finishSession();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  } finally { finishSession(); }
});

test("novo login espera o logout encerrar o cookie anterior", async ({ page, context, baseURL }) => {
  const previous = { usuario: { id: 1, nome: "Ana", email: "ana@example.com" }, negocio: null, vinculos: [] };
  const next = { usuario: { id: 2, nome: "Bruna", email: "bruna@example.com" }, negocio: null, vinculos: [] };
  let finishLogout;
  const logoutGate = new Promise(resolve => { finishLogout = resolve; });
  const events = [];
  const server = await sessionServer(baseURL, async (req, res, path) => {
    if (path === "/logout") {
      events.push("logout:start");
      await logoutGate;
      events.push("logout:response");
      res.writeHead(204, { "Set-Cookie": "af_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax" });
      return res.end();
    }
    if (path === "/login") {
      events.push("login");
      return json(res, next, "af_session=nova; Path=/; HttpOnly; SameSite=Lax");
    }
    let body = [];
    if (path === "/minha-sessao") body = req.headers.cookie?.includes("af_session=nova") ? next : previous;
    if (path === "/auth/configuracao-publica") body = { googleClientId: "" };
    return json(res, body);
  });
  await context.addCookies([{ name: "af_session", value: "anterior", url: server.origin }]);
  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  try {
    await page.goto(server.origin);
    await page.getByLabel("Abrir conta de Ana").click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect.poll(() => events).toEqual(["logout:start"]);
    await page.getByRole("link", { name: "Entrar na sua conta" }).click();
    await page.getByLabel("E-mail", { exact: true }).fill("bruna@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-teste");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Aguarde...", exact: true })).toBeDisabled();
    expect(events).toEqual(["logout:start"]);
    // A janela negativa também detecta o envio antecipado que originou a corrida.
    await expect(page.waitForRequest(req => new URL(req.url()).pathname === "/login", { timeout: 250 }))
      .rejects.toThrow(/Timeout/);
    finishLogout();
    await expect(page.getByLabel("Abrir conta de Bruna")).toBeVisible();
    expect(events).toEqual(["logout:start", "logout:response", "login"]);
    expect((await context.cookies()).find(cookie => cookie.name === "af_session")?.value).toBe("nova");
  } finally {
    finishLogout();
    await server.close();
  }
});

test("conexão interrompida no corpo não confirma gravação", async ({ page, baseURL }) => {
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", new URL(baseURL).origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write('{"configuracao":');
    setTimeout(() => res.destroy(), 30);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto("/entrar");
    const result = await page.evaluate(async url => {
      const { apiRequest } = await import("/src/api/client.js");
      try {
        await apiRequest(url, { method: "PUT", body: {} });
        return { confirmed: true };
      } catch (error) {
        return { status: error.status, code: error.data?.codigo };
      }
    }, `http://127.0.0.1:${server.address().port}/agenda-configuracao`);
    expect(result).toEqual({ status: 502, code: "INVALID_RESPONSE" });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
