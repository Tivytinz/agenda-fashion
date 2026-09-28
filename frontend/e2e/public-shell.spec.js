import { expect, test } from "@playwright/test";

async function horizontalOverflowDiagnostics(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
}

test("experiência pública usa shell próprio sem overflow e com foco visível", async ({ page }) => {
  await page.goto("/entrar");

  const shell = page.locator('[data-frontend-context="public"]');
  await expect(shell).toBeVisible();
  await expect(shell.locator(".site-header")).toBeVisible();
  await expect(shell.locator(".legal-footer")).toBeVisible();

  await expect(page.locator('[data-frontend-context="owner"]')).toHaveCount(0);
  await expect(page.locator('[data-frontend-context="professional"]')).toHaveCount(0);
  await expect(page.locator('[data-frontend-context="admin"]')).toHaveCount(0);

  const focusTarget = page.getByRole("link", { name: "Agenda Fashion, início" });
  await focusTarget.focus();
  const outlineStyle = await focusTarget.evaluate((element) =>
    window.getComputedStyle(element).outlineStyle
  );
  expect(outlineStyle).not.toBe("none");

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});

test("home móvel permite pausar a rotação do hero sem overflow", async ({ page }) => {
  await page.route("**/negocios-publicos**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      negocios: [],
      localidades: [],
      paginacao: { total: 0, tem_mais: false }
    })
  }));

  await page.route("**/marketing/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ enabled: false })
  }));

  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));

  await page.goto("/");

  const pauseButton = page.getByRole("button", {
    name: "Pausar rotação automática dos destaques"
  });
  await expect(pauseButton).toBeVisible();
  await expect(pauseButton).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", {
    name: "Mostrar destaque 2: Unhas do seu jeito"
  }).click();

  await expect(page.getByRole("heading", {
    name: "Unhas do seu jeito"
  })).toBeVisible();

  const resumeButton = page.getByRole("button", {
    name: "Retomar rotação automática dos destaques"
  });
  await expect(resumeButton).toBeVisible();
  await expect(resumeButton).toHaveAttribute("aria-pressed", "true");

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});



test("cliente multi-papel mantém conta no PublicShell e navegação mobile sem sobreposição", async ({ page }) => {
  const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });

  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("usuario", JSON.stringify({
      id: 31,
      nome: "Cliente Dona",
      email: "cliente@example.com",
      whatsapp: "62999998888"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: {
      id: 31,
      nome: "Cliente Dona",
      email: "cliente@example.com",
      whatsapp: "62999998888",
      aceita_notificacoes_whatsapp: false
    },
    negocio: {
      id: 7,
      nome: "Meu Studio",
      papel: "dono",
      publicado: true
    },
    vinculos: [{
      id: 7,
      nome: "Meu Studio",
      papel: "dono",
      publicado: true
    }],
    temNegocio: true,
    administrador: null,
    ehAdministrador: false
  }));
  await page.route("**/conta", (route) => json(route, {
    usuario: {
      id: 31,
      nome: "Cliente Dona",
      email: "cliente@example.com",
      whatsapp: "62999998888",
      aceita_lembretes_whatsapp: false,
      aceita_notificacoes_whatsapp: false,
      aceita_alertas_operacionais_whatsapp: false
    }
  }));
  await page.route("**/marketing/**", (route) => json(route, { enabled: false }));
  await page.route("**/eventos-produto", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto("/cliente/conta");

  await expect(page.locator('[data-frontend-context="public"]')).toBeVisible();
  await expect(page.locator('[data-frontend-context="owner"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Minha conta" })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Área da cliente" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Agenda" })).toHaveAttribute(
    "href",
    "/minha-agenda"
  );
  await expect(navigation.getByRole("link", { name: "Conta" })).toHaveAttribute(
    "href",
    "/cliente/conta"
  );

  const logout = page.getByRole("button", { name: "Sair da conta" });
  await logout.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const [logoutBox, navBox] = await Promise.all([
      logout.boundingBox(),
      navigation.boundingBox()
    ]);

    return Boolean(
      logoutBox &&
      navBox &&
      logoutBox.y + logoutBox.height <= navBox.y
    );
  }).toBe(true);

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});
