import { expect, test } from "@playwright/test";

const USER = {
  id: 51,
  nome: "Dona Monetização",
  email: "dona@example.com",
  whatsapp: "62999997777"
};

const BUSINESS = {
  id: 71,
  nome: "Studio Monetiza",
  slug: "studio-monetiza",
  papel: "dono",
  publicado: true
};

const FREE_PLAN = {
  id: 1,
  slug: "inicial",
  nome: "Grátis",
  valor: 0,
  capacidade_agendamentos: 10,
  limite_profissionais: 1,
  limite_servicos: 2
};

const PAID_PLAN = {
  id: 2,
  slug: "autonoma",
  nome: "Autônoma",
  valor: 49.9,
  capacidade_agendamentos: 20,
  limite_profissionais: 1,
  limite_servicos: 4
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function prepareAuthenticatedOwner(page) {
  await page.addInitScript(({ user, business }) => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("usuario", JSON.stringify(user));
    localStorage.setItem("negocio", JSON.stringify(business));
    localStorage.setItem(
      "af_marketing_consent_v2",
      JSON.stringify({
        version: 2,
        status: "denied",
        updatedAt: "2026-09-23T00:00:00.000Z"
      })
    );
  }, {
    user: USER,
    business: BUSINESS
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: USER,
    negocio: BUSINESS,
    vinculos: [BUSINESS],
    temNegocio: true,
    administrador: null,
    ehAdministrador: false
  }));

  await page.route("**/marketing/meta/config", (route) => json(route, {
    enabled: false,
    pixelId: null
  }));
  await page.route("**/marketing/google/config", (route) => json(route, {
    enabled: false,
    measurementId: null
  }));
  await page.route("**/marketing/google/consentimento", (route) => json(route, {
    consentimento: false
  }));
  await page.route("**/analytics/collect", async (route) => {
    await route.fulfill({ status: 204, body: "" });
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

test("dona cria um único checkout PIX e só vê o plano ativo após ativação financeira", async ({ page }) => {
  await prepareAuthenticatedOwner(page);

  let checkoutRequests = 0;
  let statusChecks = 0;
  let checkoutBody = null;
  let idempotencyKey = "";

  await page.route("**/planos", (route) => {
    if (route.request().resourceType() === "document") {
      return route.continue();
    }

    return json(route, {
      planos: [FREE_PLAN, PAID_PLAN]
    });
  });

  await page.route("**/meu-plano", (route) => json(route, {
    negocio_id: BUSINESS.id,
    negocio_nome: BUSINESS.nome,
    plano_id: FREE_PLAN.id,
    plano_nome: FREE_PLAN.nome,
    plano_slug: FREE_PLAN.slug,
    plano_selecionado_id: FREE_PLAN.id,
    plano_selecionado_nome: FREE_PLAN.nome,
    plano_selecionado_slug: FREE_PLAN.slug,
    assinatura_ativa_id: null,
    utilizados: 3,
    capacidade_agendamentos: 10,
    restantes: 7,
    percentual: 30
  }));

  await page.route("**/checkout", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }

    checkoutRequests += 1;
    checkoutBody = route.request().postDataJSON();
    idempotencyKey =
      route.request().headers()["idempotency-key"] || "";

    return json(route, {
      mensagem: "PIX gerado com sucesso.",
      forma_pagamento: "pix",
      assinatura: {
        id: 81,
        plano_id: PAID_PLAN.id,
        status: "PENDING",
        ativo: false
      },
      pagamento: {
        id: "pay_wave19",
        status: "PENDING",
        value: PAID_PLAN.valor
      },
      pix: {
        payload: "000201PIX-WAVE19",
        encodedImage: ""
      }
    }, 201);
  });

  await page.route("**/checkout/status/pay_wave19", (route) => {
    statusChecks += 1;

    if (statusChecks === 1) {
      return json(route, {
        id: "pay_wave19",
        status: "CONFIRMED",
        ativo: false,
        status_assinatura: "PENDING",
        estado_ativacao: "PAGAMENTO_CONFIRMADO_ATIVANDO"
      });
    }

    return json(route, {
      id: "pay_wave19",
      status: "CONFIRMED",
      ativo: true,
      status_assinatura: "ACTIVE",
      estado_ativacao: "ATIVO"
    });
  });

  await page.route("**/minha-assinatura", (route) => json(route, {
    plano: PAID_PLAN,
    assinatura: {
      id: 81,
      status: "ACTIVE",
      ativo: true,
      forma_pagamento: "pix",
      data_proxima_cobranca: "2026-10-23"
    },
    estado_assinatura: {
      codigo: "ATIVA",
      status_provedor: "ACTIVE",
      assinatura_id: 81,
      plano_id: PAID_PLAN.id
    },
    upgrade_pendente: null,
    uso: {
      plano_id: PAID_PLAN.id,
      plano_nome: PAID_PLAN.nome,
      plano_slug: PAID_PLAN.slug,
      utilizados: 3,
      limite: 20,
      restantes: 17,
      percentual: 15,
      profissionais_utilizados: 1,
      limite_profissionais: 1,
      servicos_utilizados: 2,
      limite_servicos: 4
    },
    pagamentos: [
      {
        id: 91,
        data_pagamento: "2026-09-23",
        valor: PAID_PLAN.valor,
        forma_pagamento: "pix",
        status: "CONFIRMED"
      }
    ]
  }));

  await page.goto("/planos");

  const paidCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Autônoma" })
  });
  await paidCard.getByRole("link", {
    name: "Escolher plano"
  }).click();

  await expect(page).toHaveURL(/\/checkout\?plano=autonoma$/);
  await expect(page.getByRole("heading", {
    name: "Finalize seu plano"
  })).toBeVisible();

  await page.getByRole("textbox", {
    name: "CPF ou CNPJ"
  }).fill("11144477735");
  await page.getByRole("button", {
    name: "Gerar PIX"
  }).click();

  await expect(page.getByRole("heading", {
    name: "PIX gerado"
  })).toBeVisible();
  await expect(
    page.locator(".pix-box textarea")
  ).toHaveValue("000201PIX-WAVE19");

  expect(checkoutRequests).toBe(1);
  expect(checkoutBody).toEqual(expect.objectContaining({
    plano_id: PAID_PLAN.id,
    plano_slug: PAID_PLAN.slug,
    forma_pagamento: "pix",
    cpf_cnpj: "11144477735"
  }));
  expect(idempotencyKey).toMatch(/^checkout-/);

  await expect(page.getByText(
    "Pagamento confirmado. Estamos ativando seu plano..."
  )).toBeVisible({
    timeout: 5000
  });
  await expect(page).toHaveURL(/\/checkout\?plano=autonoma$/);

  await expect(page).toHaveURL(
    /\/painel\/assinatura$/,
    { timeout: 9000 }
  );

  await expect(page.getByRole("heading", {
    name: "Plano e assinatura"
  })).toBeVisible();
  await expect(page.getByText("Assinatura ativa")).toBeVisible();
  await expect(
    page.locator(".billing-effective-plan")
  ).toContainText("Autônoma");
  await expect(page.getByRole("table")).toContainText("Pago");

  expect(checkoutRequests).toBe(1);
  expect(statusChecks).toBeGreaterThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
});

test("upgrade PIX pendente reaparece após recarga sem abrir novo checkout", async ({ page }) => {
  await prepareAuthenticatedOwner(page);

  let checkoutRequests = 0;

  await page.route("**/checkout", async (route) => {
    if (route.request().method() === "POST") {
      checkoutRequests += 1;
      return json(route, {
        mensagem: "Não deveria criar outra cobrança."
      }, 500);
    }

    return route.continue();
  });

  await page.route("**/minha-assinatura", (route) => json(route, {
    plano: FREE_PLAN,
    assinatura: null,
    estado_assinatura: {
      codigo: "PENDENTE",
      status_provedor: "PENDING",
      assinatura_id: 82,
      plano_id: PAID_PLAN.id
    },
    upgrade_pendente: {
      plano: PAID_PLAN,
      assinatura: {
        id: 82,
        status: "PENDING",
        ativo: false,
        forma_pagamento: "pix"
      },
      pagamento: {
        id: 92,
        status: "PENDING",
        pix_copia_cola: "000201PIX-PENDENTE-WAVE19",
        pix_qrcode: ""
      }
    },
    uso: {
      plano_id: FREE_PLAN.id,
      plano_nome: FREE_PLAN.nome,
      plano_slug: FREE_PLAN.slug,
      utilizados: 3,
      limite: 10,
      restantes: 7,
      percentual: 30,
      profissionais_utilizados: 1,
      limite_profissionais: 1,
      servicos_utilizados: 2,
      limite_servicos: 2
    },
    pagamentos: []
  }));

  await page.goto("/painel/assinatura");

  await expect(page.getByText(
    "PIX do plano Autônoma aguardando pagamento."
  )).toBeVisible();
  await expect(page.getByRole("textbox", {
    name: "Código PIX pendente"
  })).toHaveValue("000201PIX-PENDENTE-WAVE19");
  await expect(
    page.locator(".billing-effective-plan")
  ).toContainText("Grátis");

  await page.reload();

  await expect(page.getByText(
    "PIX do plano Autônoma aguardando pagamento."
  )).toBeVisible();
  await expect(page.getByRole("textbox", {
    name: "Código PIX pendente"
  })).toHaveValue("000201PIX-PENDENTE-WAVE19");
  expect(checkoutRequests).toBe(0);
  await expectNoHorizontalOverflow(page);
});
