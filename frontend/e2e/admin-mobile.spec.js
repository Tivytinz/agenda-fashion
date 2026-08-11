import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toEqual(expect.objectContaining({
    clientWidth: page.viewportSize().width,
    scrollWidth: page.viewportSize().width
  }));
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

test("admin e consentimento permanecem navegáveis no celular", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "admin-e2e");
    localStorage.setItem(
      "usuario",
      JSON.stringify({ id: 9, nome: "Admin AF" })
    );
    localStorage.removeItem("af_marketing_consent_v1");
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: {
      id: 9,
      nome: "Admin AF",
      email: "admin@example.com"
    },
    negocio: null,
    temNegocio: false,
    administrador: { usuarioId: 9 },
    ehAdministrador: true
  }));
  await page.route("**/marketing/meta/config", (route) => json(route, {
    enabled: true,
    pixelId: "123456789"
  }));
  await page.route("**/marketing/meta/consentimento", (route) => json(route, {
    consentimento: true
  }));
  await page.route("https://connect.facebook.net/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: ""
  }));
  await page.route("**/admin/marketing/resumo**", (route) => json(route, {
    sessoes: 12,
    campanhas: 2,
    agendamentosIniciados: 4,
    agendamentosConcluidos: 2,
    taxaConversao: 16.67
  }));
  await page.route("**/admin/marketing/campanhas**", (route) => json(route, {
    campanhas: []
  }));
  await page.route("**/admin/marketing/conversoes**", (route) => json(route, {
    conversoes: []
  }));
  await page.route("**/admin/marketing/gestao-campanhas", (route) => json(route, {
    campanhas: []
  }));

  await page.goto("/admin/trafego-pago");

  await expect(
    page.getByRole("heading", { name: "Marketing e tráfego pago" })
  ).toBeVisible();
  const navigation = page.getByRole("navigation", {
    name: "Administração do Agenda Fashion"
  });
  await expect(navigation.getByRole("link", { name: /Marketing/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Custos/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Funil/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Minha conta/ }))
    .toBeVisible();

  const consent = page.getByRole("complementary", {
    name: "Preferências de privacidade"
  });
  const allow = consent.getByRole("button", { name: "Permitir" });
  const deny = consent.getByRole("button", { name: "Não permitir" });

  await expect(consent).toBeVisible();
  await expect(allow).toBeVisible();
  await expect(deny).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const [consentBox, allowBox, denyBox, navigationBox] = await Promise.all([
    consent.boundingBox(),
    allow.boundingBox(),
    deny.boundingBox(),
    navigation.boundingBox()
  ]);

  expect(consentBox.x).toBeGreaterThanOrEqual(0);
  expect(consentBox.x + consentBox.width)
    .toBeLessThanOrEqual(page.viewportSize().width);
  expect(allowBox.x + allowBox.width)
    .toBeLessThanOrEqual(page.viewportSize().width);
  expect(denyBox.x).toBeGreaterThanOrEqual(0);
  expect(consentBox.y + consentBox.height)
    .toBeLessThanOrEqual(navigationBox.y);

  await allow.click();
  await expect(consent).toBeHidden();
  await expectNoHorizontalOverflow(page);
});
