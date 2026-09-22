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

