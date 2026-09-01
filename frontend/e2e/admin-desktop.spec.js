import { expect, test } from "@playwright/test";

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toEqual(expect.objectContaining({
    clientWidth: page.viewportSize().width,
    scrollWidth: page.viewportSize().width
  }));
}

async function stubAdminMarketingOverview(page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "admin-desktop-e2e");
    localStorage.setItem(
      "usuario",
      JSON.stringify({ id: 9, nome: "Admin AF" })
    );
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
    enabled: false,
    pixelId: ""
  }));
  await page.route("**/marketing/meta/consentimento", (route) => json(route, {
    consentimento: false
  }));
  await page.route("**/admin/marketing/resumo**", (route) => json(route, {}));
  await page.route("**/admin/marketing/campanhas**", (route) => json(route, {
    campanhas: []
  }));
  await page.route("**/admin/marketing/funil-profissionais**", (route) => json(route, {
    resumo: {
      cadastros: 13,
      negociosCriados: 11,
      servicosCriados: 7,
      negociosPublicados: 7,
      primeirosAgendamentos: 1,
      checkoutsIniciados: 0,
      assinaturasAtivadas: 0
    },
    qualidadeMensuracao: {
      coberturaAtribuicaoPagaPercentual: 100
    }
  }));
  await page.route("**/admin/marketing/ga4**", (route) => json(route, {
    habilitado: true,
    configurado: true,
    resumo: {
      sessoes: 29,
      usuarios: 14,
      novosUsuarios: 13,
      sessoesEngajadas: 26,
      taxaEngajamentoPercentual: 89.7,
      visualizacoes: 314
    },
    canais: [],
    campanhas: [],
    landingPages: [],
    dispositivos: [],
    localidades: []
  }));
  await page.route("**/admin/marketing/custos-integracoes", (route) => json(route, {
    sincronizacaoAutomatica: { habilitado: false },
    provedores: [],
    vinculos: []
  }));
}

async function expectMarketingControlsInsideWorkspace(page) {
  const workspace = page.locator(".marketing-command-page-v3");
  const navigation = page.getByRole("navigation", {
    name: "Áreas do marketing"
  });
  const period = page.locator('[aria-label="Período do marketing"]');

  await expect(
    page.getByRole("heading", { name: "Marketing e aquisição" })
  ).toBeVisible();
  await expect(
    navigation.getByText("Visão geral", { exact: true })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Funil completo" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Custos e retorno" })
  ).toBeVisible();
  await expect(
    period.getByRole("button", { name: "Todo período" })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const [workspaceBox, navigationBox, periodBox] = await Promise.all([
    workspace.boundingBox(),
    navigation.boundingBox(),
    period.boundingBox()
  ]);

  expect(workspaceBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(periodBox).not.toBeNull();
  expect(navigationBox.x).toBeGreaterThanOrEqual(workspaceBox.x);
  expect(periodBox.x).toBeGreaterThanOrEqual(workspaceBox.x);
  expect(navigationBox.x + navigationBox.width)
    .toBeLessThanOrEqual(workspaceBox.x + workspaceBox.width + 1);
  expect(periodBox.x + periodBox.width)
    .toBeLessThanOrEqual(workspaceBox.x + workspaceBox.width + 1);
}

test("marketing admin não corta navegação ou período em desktops intermediários", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("desktop-"),
    "Cobertura dedicada aos projetos desktop do admin."
  );

  await stubAdminMarketingOverview(page);

  for (const width of [1024, 1280, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/admin/trafego-pago");
    await expectMarketingControlsInsideWorkspace(page);
  }
});
