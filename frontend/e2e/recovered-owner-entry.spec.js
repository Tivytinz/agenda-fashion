import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2, status: "denied", updatedAt: "2026-11-05T00:00:00.000Z"
    }));
  });
});

const owner = { id: 11, nome: "Studio Aurora", slug: "studio-aurora", papel: "dono", publicado: false };
test("conta existente acessa o cadastro do negócio sem novo cadastro de conta", async ({ page }) => {
  await page.route("**/minha-sessao", route => route.fulfill({ json: {
    usuario: { id: 4, nome: "Ana", whatsapp: "62999999999" }, negocio: null, temNegocio: false, ehAdministrador: false
  } }));
  await page.route("**/negocios-publicos**", route => route.fulfill({ json: { negocios: [], localidades: [] } }));
  await page.route("**/marketing/**", route => route.fulfill({ json: { enabled: false } }));
  await page.goto("/");
  const entry = page.locator(".header-business-entry");
  await expect(entry).toHaveAttribute("href", "/criar-negocio");
  await entry.click();
  await expect(page.getByRole("textbox", { name: "Nome do negócio", exact: true })).toBeVisible();
});

test("primeiro serviço usa uma coluna e mantém ambas as ações acessíveis", async ({ page }) => {
  await page.route("**/minha-sessao", route => route.fulfill({ json: {
    usuario: { id: 4, nome: "Ana" }, negocio: owner, temNegocio: true, ehAdministrador: false
  } }));
  await page.route("**/marketing/**", route => route.fulfill({ json: { enabled: false } }));
  await page.goto("/painel/servicos/novo?onboarding=servico");
  const form = page.getByRole("form", { name: "Cadastro do primeiro serviço" });
  await expect(form).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await form.evaluate(element => {
      const panel = element.querySelector(".panel").getBoundingClientRect();
      const actions = element.querySelector(".service-editor-actions").getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return { width: box.width, panel: panel.width, actions: actions.width,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(Math.abs(geometry.width - geometry.panel)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.width - geometry.actions)).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBe(false);
    for (const action of [page.getByRole("button", { name: "Salvar serviço e publicar" }), page.getByRole("link", { name: "Cancelar", exact: true })]) {
      await action.scrollIntoViewIfNeeded();
      await action.click({ trial: true });
    }
  }
});
