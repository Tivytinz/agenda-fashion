import { createServer } from "node:http";
import { expect, test } from "@playwright/test";

test("Sair durante um login aguarda o cookie novo e revoga essa sessão", async ({ page, context, baseURL }) => {
  let finishLogin;
  const gate = new Promise(resolve => { finishLogin = resolve; });
  const events = [];
  await context.addCookies([{ name: "af_session", value: "anterior", url: baseURL }]);
  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  await page.route("**/*", async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (!["fetch", "xhr"].includes(req.resourceType())) return route.continue();
    if (path === "/login") {
      events.push("login:start");
      await gate;
      events.push("login:response");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usuario: { id: 2, nome: "Bruna" } }), headers: { "Set-Cookie": "af_session=nova; Path=/; HttpOnly; SameSite=Lax" } });
    }
    if (path === "/logout") {
      expect((await req.allHeaders()).cookie).toContain("af_session=nova");
      events.push("logout:nova");
      return route.fulfill({ status: 204, headers: { "Set-Cookie": "af_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax" } });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usuario: { id: 1, nome: "Ana" }, vinculos: [] }) });
  });
  try {
    await page.goto("/e2e/fixtures/session-transitions.html");
    await expect(page.getByTestId("session")).toHaveText("Ana");
    await page.getByRole("button", { name: "Autenticar" }).click();
    await expect.poll(() => events).toEqual(["login:start"]);
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page.getByTestId("session")).toHaveText("Desconectada");
    expect(events).toEqual(["login:start"]);
    finishLogin();
    await expect.poll(() => events).toEqual(["login:start", "login:response", "logout:nova"]);
    await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name === "af_session")).toBe(false);
    await expect(page.getByTestId("session")).toHaveText("Desconectada");
    expect(await page.evaluate(() => localStorage.getItem("session_active"))).toBeNull();
  } finally { finishLogin(); }
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
  await context.addCookies([{ name: "af_session", value: "anterior", url: baseURL }]);
  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  await page.route("**/*", async route => {
    const req = route.request();
    if (!["fetch", "xhr"].includes(req.resourceType())) return route.continue();
    const path = new URL(req.url()).pathname;
    if (path === "/logout") {
      events.push("logout:start");
      await logoutGate;
      events.push("logout:response");
      return route.fulfill({ status: 204, headers: { "Set-Cookie": "af_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax" } });
    }
    if (path === "/login") {
      events.push("login");
      return route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify(next),
        headers: { "Set-Cookie": "af_session=nova; Path=/; HttpOnly; SameSite=Lax" }
      });
    }
    let body = [];
    if (path === "/minha-sessao") body = (await req.allHeaders()).cookie?.includes("af_session=nova") ? next : previous;
    if (path === "/auth/configuracao-publica") body = { googleClientId: "" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  try {
    await page.goto("/");
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
