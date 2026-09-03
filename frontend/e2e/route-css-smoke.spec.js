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

function watchCssRequests(page) {
  const requests = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(".css")) {
      requests.push(url.pathname);
    }
  });

  return requests;
}

async function expectCssRequested(requests, fileName) {
  await expect.poll(() => requests.some((pathname) => (
    pathname.includes(fileName)
  ))).toBe(true);
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

test("planos carrega o CSS exclusivo da rota antes de renderizar", async ({ page }) => {
  const cssRequests = watchCssRequests(page);
  await disableMarketingMeasurement(page);

  await page.route("**/planos", (route) => json(route, {
    planos: [{
      id: 1,
      nome: "Grátis",
      slug: "inicial",
      valor: 0,
      capacidade_agendamentos: 10,
      limite_profissionais: 1,
      limite_servicos: 2,
      destaque: false
    }]
  }));

  await page.goto("/planos");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Planos que acompanham seu sucesso"
  })).toBeVisible();
  await expectCssRequested(cssRequests, "plans-polish.css");
  await expectNoHorizontalOverflow(page);
});

test("dashboard carrega o CSS profissional somente ao entrar no workspace", async ({ page }) => {
  const cssRequests = watchCssRequests(page);
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
  await expectCssRequested(cssRequests, "dashboard-polish.css");
  await expectNoHorizontalOverflow(page);
});

test("saúde do SaaS carrega seu CSS administrativo sob demanda", async ({ page }) => {
  const cssRequests = watchCssRequests(page);
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
    name: "Saúde do SaaS"
  })).toBeVisible();
  await expectCssRequested(cssRequests, "admin-saas-health.css");
  await expectNoHorizontalOverflow(page);
});

test("WhatsApp administrativo carrega seu CSS sob demanda", async ({ page }) => {
  const cssRequests = watchCssRequests(page);
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
    name: "WhatsApp e templates"
  })).toBeVisible();
  await expectCssRequested(cssRequests, "admin-whatsapp.css");
  await expectNoHorizontalOverflow(page);
});
