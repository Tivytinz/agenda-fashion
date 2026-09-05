import { expect, test } from "@playwright/test";

const OWNER_BUSINESS = {
  id: 11,
  slug: "studio-aurora",
  nome: "Studio Aurora",
  descricao: "Beleza com hora marcada",
  whatsapp: "11999999999",
  cidade: "São Paulo",
  estado: "SP",
  bairro: "Centro",
  endereco: "Rua das Flores",
  numero: "10",
  cep: "01001000",
  areas: ["Unhas"],
  papel: "dono",
  publicado: true
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function expectComputedStyle(locator, property, expected) {
  await expect.poll(() => locator.evaluate(
    (element, styleProperty) => getComputedStyle(element)[styleProperty],
    property
  )).toBe(expected);
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

async function disableMarketingMeasurement(page) {
  await page.addInitScript(() => {
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-09-03T00:00:00.000Z"
    }));
  });

  await page.route("**/marketing/meta/config", (route) => json(route, {
    enabled: false,
    pixelId: null
  }));
  await page.route("**/marketing/google/config", (route) => json(route, {
    enabled: false,
    measurementId: null
  }));
  await page.route("**/eventos-produto", (route) => json(route, { ok: true }, 201));
}

async function installOwnerSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "owner-css-smoke");
    localStorage.setItem("usuario", JSON.stringify({ id: 4, nome: "Ana" }));
    localStorage.setItem("negocio", JSON.stringify({
      id: 11,
      nome: "Studio Aurora",
      papel: "dono"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 4, nome: "Ana", email: "ana@example.com" },
    negocio: OWNER_BUSINESS,
    temNegocio: true,
    administrador: null,
    ehAdministrador: false
  }));
}

async function installAdminSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "admin-css-smoke");
    localStorage.setItem("usuario", JSON.stringify({ id: 9, nome: "Admin AF" }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 9, nome: "Admin AF", email: "admin@example.com" },
    negocio: null,
    temNegocio: false,
    administrador: { usuarioId: 9 },
    ehAdministrador: true
  }));
}

test("planos aplica o CSS exclusivo da rota antes de renderizar", async ({ page }) => {
  await disableMarketingMeasurement(page);
  await installOwnerSession(page);

  await page.route("**/planos", async (route) => {
    if (route.request().isNavigationRequest()) {
      await route.continue();
      return;
    }

    await json(route, {
      planos: [{
        id: 2,
        nome: "Profissional",
        slug: "profissional",
        valor: 39.9,
        capacidade_agendamentos: 100,
        limite_profissionais: 3,
        limite_servicos: 20,
        destaque: false
      }]
    });
  });
  await page.route("**/meu-plano", (route) => json(route, {
    plano_id: 1,
    plano_slug: "inicial",
    plano_selecionado_id: 2,
    plano_selecionado_slug: "profissional"
  }));

  await page.goto("/planos");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Planos que acompanham seu sucesso"
  })).toBeVisible();

  const selectedBadge = page.locator(".plans-page .plan-selected-badge");
  await expect(selectedBadge).toBeVisible();
  await expectComputedStyle(selectedBadge, "position", "absolute");
  await expectComputedStyle(selectedBadge, "minHeight", "28px");
  await expectNoHorizontalOverflow(page);
});

test("dashboard aplica o CSS profissional ao entrar no workspace", async ({ page }) => {
  await disableMarketingMeasurement(page);
  await installOwnerSession(page);

  await page.route("**/dashboard-dono?periodo=7dias", (route) => json(route, {
    resumo: {},
    performance: {},
    ranking_servicos: []
  }));
  await page.route("**/dashboard-dono/origem-clientes?periodo=7dias", (route) => json(route, {
    resumo: {},
    origens: []
  }));
  await page.route("**/configuracoes", (route) => json(route, {
    negocio: OWNER_BUSINESS,
    publicacao: {
      publicado: true,
      pode_publicar: true,
      pendencias: []
    }
  }));
  await page.route("**/agenda-configuracao/status", (route) => json(route, {
    configurada: true,
    configurado_em: "2026-09-03T12:00:00.000Z"
  }));
  await page.route("**/conta", (route) => json(route, {
    usuario: {
      id: 4,
      aceita_lembretes_whatsapp: true,
      aceita_alertas_operacionais_whatsapp: true
    }
  }));

  await page.goto("/painel");

  await expect(page.locator("main.dashboard-page")).toBeVisible();
  const metricCard = page.locator(".dashboard-page .metric-card").first();
  await expect(metricCard).toBeVisible();
  await expectComputedStyle(metricCard, "minHeight", "118px");
  await expectNoHorizontalOverflow(page);
});

test("ativação profissional aplica seu CSS administrativo sob demanda", async ({ page }) => {
  await disableMarketingMeasurement(page);
  await installAdminSession(page);

  await page.route("**/admin/saude/perfis-incompletos**", (route) => json(route, {
    resumo: {
      totalProfissionais: 0,
      totalIncompletos: 0,
      semNegocio: 0,
      perfilIncompleto: 0,
      semServico: 0,
      semAgenda: 0,
      naoPublicados: 0
    },
    perfis: [],
    paginacao: {
      pagina: 1,
      totalPaginas: 1,
      total: 0
    }
  }));

  await page.goto("/admin/saude");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Ativação profissional"
  })).toBeVisible();

  const metricCard = page.locator(".saas-health-metric-card").first();
  await expect(metricCard).toBeVisible();
  await expectComputedStyle(metricCard, "cursor", "pointer");
  await expectComputedStyle(metricCard, "textAlign", "left");
  await expectNoHorizontalOverflow(page);
});

test("WhatsApp administrativo aplica seu CSS sob demanda", async ({ page }) => {
  await disableMarketingMeasurement(page);
  await installAdminSession(page);

  await page.route("**/admin/whatsapp/templates?periodo=30", (route) => json(route, {
    resumo: {
      templatesAprovadosMeta: null,
      templatesEsperados: 0,
      automacoesHabilitadas: 0,
      total: 0,
      aceitas: 0,
      entregues: 0,
      lidas: 0,
      taxaEntrega: null,
      taxaLeitura: null
    },
    verificacaoMeta: {
      disponivel: false,
      mensagem: "Status ainda não consultado.",
      variaveisAusentes: []
    },
    configuracao: {
      notificacoesHabilitadas: false
    },
    templates: []
  }));

  await page.goto("/admin/whatsapp");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "WhatsApp e automações"
  })).toBeVisible();

  const healthNotice = page.locator(".whatsapp-health-notice");
  await expect(healthNotice).toBeVisible();
  await expectComputedStyle(healthNotice, "borderRadius", "10px");
  await expectNoHorizontalOverflow(page);
});
