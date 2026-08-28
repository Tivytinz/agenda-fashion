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
    totalSessoes: 229,
    sessoes: 20,
    sessoesAutonomas: 209,
    sessoesSemAtribuicao: 209,
    campanhas: 1,
    agendamentosIniciados: 0,
    agendamentosConcluidos: 0,
    taxaConversao: 0
  }));
  await page.route("**/admin/marketing/campanhas**", (route) => json(route, {
    campanhas: [
      {
        origem: "google",
        midia: "cpc",
        campanha: "google_ads_profissionais",
        objetivo: "profissional",
        oficial: true,
        classificacaoAtribuicao: "oficial",
        sessoes: 20,
        sessoesAtribuicaoDireta: 13,
        sessoesAtribuicaoAssistida: 7,
        perfisVisualizados: 7,
        agendamentosIniciados: 0,
        agendamentosConcluidos: 0,
        taxaConversao: 0
      }
    ]
  }));
  await page.route("**/admin/marketing/conversoes**", (route) => json(route, {
    conversoes: []
  }));
  await page.route("**/admin/marketing/gestao-campanhas", (route) => json(route, {
    campanhas: [
      {
        id: 7,
        nome: "Google Ads · Aquisição de profissionais",
        canal: "google",
        objetivo: "profissional",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "google_ads_profissionais",
        destinoPath: "/para-profissionais",
        ativo: true,
        linkRastreavel: "https://app.agendafashion.com.br/para-profissionais?utm_source=google&utm_medium=cpc&utm_campaign=google_ads_profissionais"
      }
    ]
  }));
  await page.route(/\/admin\/marketing\/custos(?:\?.*)?$/, (route) => json(route, {
    periodo: "30",
    moeda: "BRL",
    investimentoCentavos: 20000,
    investimentoProfissionaisCentavos: 20000,
    investimentoClientesCentavos: 0,
    sessoes: 20,
    sessoesOficiais: 20,
    sessoesAtribuicaoDireta: 13,
    sessoesAtribuicaoAssistida: 7,
    sessoesComCusto: 20,
    sessoesOficiaisSemCusto: 0,
    coberturaCustos: 100,
    sessoesSemCampanha: 0,
    sessoesIdentidadeNaoOficial: 0,
    agendamentosConcluidos: 0,
    agendamentosClientesComCusto: 0,
    custoPorSessaoCentavos: 1000,
    cpaCentavos: null,
    campanhas: [
      {
        campanhaId: 7,
        nome: "Google Ads · Aquisição de profissionais",
        canal: "google",
        objetivo: "profissional",
        ativo: true,
        investimentoCentavos: 20000,
        sessoes: 20,
        sessoesAtribuicaoDireta: 13,
        sessoesAtribuicaoAssistida: 7,
        sessoesComCusto: 20,
        sessoesSemCusto: 0,
        coberturaCustos: 100,
        agendamentosConcluidos: 0,
        agendamentosConcluidosComCusto: 0,
        custoPorSessaoCentavos: 1000,
        cpaCentavos: null
      }
    ]
  }));
  await page.route(/\/admin\/marketing\/gastos(?:\?.*)?$/, (route) => json(route, {
    periodo: "30",
    gastos: []
  }));
  await page.route("**/admin/marketing/custos-integracoes", (route) => json(route, {
    sincronizacaoAutomatica: {
      habilitado: false,
      intervaloHoras: 6,
      limiteDesatualizadoHoras: 24
    },
    provedores: [],
    vinculos: []
  }));

  await page.goto("/admin/trafego-pago");

  await expect(
    page.getByRole("heading", { name: "Campanhas e tráfego pago" })
  ).toBeVisible();
  const attributionCoverageCard = page
    .locator("article.metric-card")
    .filter({
      has: page.getByText("Cobertura de atribuição", { exact: true })
    });
  await expect(attributionCoverageCard).toBeVisible();
  await expect(
    attributionCoverageCard.getByText("100%", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("13 diretas + 7 assistidas")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Qualidade da medição paga" })
  ).toBeVisible();
  const navigation = page.getByRole("navigation", {
    name: "Administração do Agenda Fashion"
  });
  await expect(navigation.getByRole("link", { name: /Campanhas/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Custos/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Aquisição e retorno/ }))
    .toBeVisible();
  const more = navigation.getByRole("button", {
    name: /Abrir mais opções/
  });
  await expect(more).toBeVisible();
  await more.click();
  await expect(navigation.getByRole("link", { name: /WhatsApp/ }))
    .toBeVisible();
  await expect(navigation.getByRole("link", { name: /Minha conta/ }))
    .toBeVisible();
  await navigation.getByRole("button", { name: /Fechar mais opções/ }).click();

  const consent = page.getByRole("complementary", {
    name: "Preferências de privacidade"
  });
  const allow = consent.getByRole("button", {
    name: "Permitir",
    exact: true
  });
  const deny = consent.getByRole("button", {
    name: "Não permitir",
    exact: true
  });

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

  await navigation.getByRole("link", { name: /Custos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Investimento e eficiência" })
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: "Cobertura de atribuição: 100%"
    })
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: "Cobertura financeira: 100%"
    })
  ).toBeVisible();
  await expect(page.getByText("13 diretas + 7 assistidas")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(2);
  await expect(page.getByText("Investimento por campanha")).toBeVisible();
  await expect(page.getByText("Sessões atribuídas por campanha")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
