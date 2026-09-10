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
