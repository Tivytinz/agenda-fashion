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



test("cliente multi-papel mantém conta pessoal no PublicShell e navegação mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
  });

  await page.route("**/minha-sessao", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      usuario: {
        id: 31,
        nome: "Cliente Dona",
        email: "cliente@example.com",
        whatsapp: "62999998888",
        aceita_notificacoes_whatsapp: true,
        aceita_alertas_operacionais_whatsapp: true,
        aceita_lembretes_whatsapp: true
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
    })
  }));

  await page.route("**/conta", (route) => {
    if (
      route.request().resourceType() === "document" ||
      route.request().method() !== "GET"
    ) {
      return route.continue();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        usuario: {
          id: 31,
          nome: "Cliente Dona",
          email: "cliente@example.com",
          whatsapp: "62999998888",
          aceita_notificacoes_whatsapp: true,
          aceita_alertas_operacionais_whatsapp: true,
          aceita_lembretes_whatsapp: true
        }
      })
    });
  });

  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));

  await page.goto("/cliente/conta");

  await expect(page.locator('[data-frontend-context="public"]')).toBeVisible();
  await expect(page.locator('[data-frontend-context="owner"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Minha conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Voltar à descoberta/ })).toHaveAttribute("href", "/");
  await expect(page.getByText("Comunicação do negócio")).toHaveCount(0);

  const clientNavigation = page.getByRole("navigation", {
    name: "Navegação da cliente"
  });
  await expect(clientNavigation).toBeVisible();
  await expect(clientNavigation.getByRole("link", { name: "Conta" }))
    .toHaveAttribute("href", "/cliente/conta");

  const logout = page.getByRole("button", { name: "Sair da conta" });
  await logout.scrollIntoViewIfNeeded();

  await expect.poll(async () => {
    const [logoutBox, navBox] = await Promise.all([
      logout.boundingBox(),
      clientNavigation.boundingBox()
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

test("visitante vê somente a reserva recente e não recebe navegação pessoal", async ({ page }) => {
  const accessToken = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

  await page.addInitScript(({ accessToken }) => {
    sessionStorage.setItem("af_recent_appointment", JSON.stringify({
      id: 90,
      negocio_id: 7,
      servico_id: 11,
      profissional_id: 21,
      negocio: "Studio Aurora",
      slug: "studio-aurora",
      profissional: "Ana",
      servico: "Manicure",
      data: "2026-09-30",
      horario: "14:00",
      valor: 50,
      status: "agendado",
      acesso_visitante: accessToken,
      source: "visitor"
    }));
  }, { accessToken });

  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));

  await page.goto("/minha-agenda");

  await expect(page.getByRole("heading", { name: "Meu agendamento" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("navigation", {
    name: "Navegação da cliente"
  })).toHaveCount(0);
  await expect(page.getByRole("link", {
    name: "Abrir acesso seguro do agendamento"
  })).toHaveAttribute(
    "href",
    `/agendamento-visitante/90#token=${accessToken}`
  );

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});
