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
    localStorage.setItem("session_active", "1");
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

test("shell do admin mantém navegação durante rolagem e privacidade fora dos dados", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("desktop-"),
    "Navegação lateral dedicada ao desktop."
  );

  await stubAdminMarketingOverview(page);
  await page.addInitScript(() => {
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied"
    }));
  });
  await page.route("**/marketing/meta/config", (route) => json(route, {
    enabled: true,
    pixelId: "123456"
  }));
  await page.route("**/admin/analytics-v2/acquisition**", (route) => json(route, {
    periodo: "30",
    sessoesPorOrigem: Array.from({ length: 30 }, (_, index) => ({
      canal: "organic_social",
      source: `origem-${index}`,
      medium: "social",
      sessoes: 1,
      usuarios: 1,
      tempo_engajado_ms: 5000
    })),
    funilPorCampanha: [],
    retornoAquisicao: { diagnostico: {}, campanhas: [] }
  }));

  await page.goto("/admin/aquisicao?periodo=30");
  await expect(page.getByRole("heading", { name: "Aquisição", exact: true })).toBeVisible();
  await expect(page.getByText("origem-29")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Privacidade" })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  const sidebar = page.locator(".admin-sidebar");
  const topbar = page.locator(".admin-topbar");
  await expect(sidebar).toBeInViewport();
  await expect(topbar).toBeInViewport();
  await expect.poll(async () => ({
    sidebarTop: Math.round((await sidebar.boundingBox()).y),
    topbarTop: Math.round((await topbar.boundingBox()).y)
  })).toEqual({ sidebarTop: 0, topbarTop: 0 });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const [shellBox, privacyBox] = await Promise.all([
    page.locator(".admin-shell").boundingBox(),
    page.getByRole("link", { name: "Privacidade" }).boundingBox()
  ]);
  await expect(page.getByRole("link", { name: "Privacidade" })).toHaveCSS("position", "static");
  expect(privacyBox.y).toBeGreaterThanOrEqual(shellBox.y + shellBox.height - 1);
  await expectNoHorizontalOverflow(page);
});

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

test("jornada e retenção mostram rótulos e explicações sem comprimir texto", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("desktop-"),
    "Cobertura dedicada aos projetos desktop do admin."
  );

  await page.addInitScript(() => localStorage.setItem("session_active", "1"));
  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 9, nome: "Admin AF" },
    negocio: null,
    administrador: { usuarioId: 9 },
    ehAdministrador: true
  }));
  await page.route("**/admin/analytics-v2/journey**", (route) => json(route, {
    periodo: "7",
    telas: [{
      page_key: "business_profile",
      route_template: "/negocio/:slug",
      visualizacoes: 17,
      sessoes: 17,
      tempo_medio_segundos: 20
    }],
    transicoes: [{ origem: "business_profile", destino: "checkout", transicoes: 10 }],
    eventos: [{ nome: "profile_viewed", eventos: 17, sessoes: 17 }],
    dispositivos: [{ device_type: "mobile", browser_family: "Chrome", sessoes: 35 }]
  }));
  await page.route("**/admin/analytics-v2/retention**", (route) => json(route, {
    periodo: "7",
    resumo: {},
    tempos: { primeiroParaSegundo: { amostra: 0, medianaDias: null } },
    janelasCandidatas: [
      { janelaDias: 7, elegiveis: 0, comSegundoNaJanela: 0, taxaSegundoNaJanela: null }
    ],
    coortesSemanais: []
  }));

  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/admin/jornada?periodo=7");

    const transition = page.locator(".admin-journey-ranking article").first();
    await expect(transition.getByText("Perfil do negócio → Checkout")).toBeVisible();
    await expect.poll(() => transition.evaluate((row) => {
      const label = row.querySelector("strong");
      const count = row.querySelector("span");
      return {
        columns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
        labelWraps: getComputedStyle(label).whiteSpace === "normal",
        countFits: count.scrollWidth <= count.clientWidth
      };
    })).toEqual({ columns: 2, labelWraps: true, countFits: true });

    const device = page.locator(".admin-journey-ranking article").last();
    await expect(device.getByText("mobile")).toBeVisible();
    await expect(device.getByText("35 sessões")).toBeVisible();
    await expect.poll(() => device.evaluate((row) => {
      const label = row.querySelector("strong");
      const count = row.querySelector("span");
      return getComputedStyle(label).whiteSpace === "normal" &&
        count.scrollWidth <= count.clientWidth;
    })).toBe(true);
    await expectNoHorizontalOverflow(page);

    const moduleNavigation = page.getByRole("navigation", {
      name: width < 901
        ? "Navegação mobile da administração"
        : "Módulos administrativos"
    });
    const retentionRequest = page.waitForRequest((request) =>
      request.url().includes("/admin/analytics-v2/retention?periodo=7")
    );
    await moduleNavigation.getByRole("link", { name: "Retenção" }).click();
    await retentionRequest;
    await expect(page).toHaveURL(/\/admin\/retencao\?periodo=7$/);
    const explanation = page.locator(".admin-retention-windows article > span").first();
    await expect(explanation).toHaveText("Sem base madura nesta janela");
    await expect.poll(() => explanation.evaluate((element) =>
      getComputedStyle(element).whiteSpace === "normal" &&
      element.getBoundingClientRect().width > 80 &&
      element.scrollHeight <= element.clientHeight
    )).toBe(true);
    await expectNoHorizontalOverflow(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/jornada\?periodo=7$/);
  }
});
