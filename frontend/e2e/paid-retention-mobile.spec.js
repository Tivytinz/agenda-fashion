import { expect, test } from "@playwright/test";

const USER = {
  id: 61,
  nome: "Dona Retenção",
  email: "retencao@example.com",
  whatsapp: "62999996666"
};

const BUSINESS = {
  id: 81,
  nome: "Studio Retenção",
  slug: "studio-retencao",
  papel: "dono",
  publicado: true
};

const FREE_PLAN = {
  id: 1,
  slug: "inicial",
  nome: "Grátis",
  valor: 0
};

const PAID_PLAN = {
  id: 2,
  slug: "autonoma",
  nome: "Autônoma",
  valor: 49.9
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function prepareOwner(page) {
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

test("cancelamento mantém o período pago e troca próxima cobrança por acesso até", async ({ page }) => {
  await prepareOwner(page);

  await page.route("**/minha-assinatura", (route) => json(route, {
    plano: PAID_PLAN,
    assinatura: {
      id: 91,
      status: "CANCELED",
      ativo: true,
      forma_pagamento: "pix",
      data_proxima_cobranca: "2026-10-23"
    },
    estado_assinatura: {
      codigo: "CANCELAMENTO_AGENDADO",
      status_provedor: "CANCELED",
      assinatura_id: 91,
      plano_id: PAID_PLAN.id
    },
    upgrade_pendente: null,
    pagamento_recuperavel: null,
    uso: {
      plano_id: PAID_PLAN.id,
      plano_nome: PAID_PLAN.nome,
      plano_slug: PAID_PLAN.slug,
      utilizados: 4,
      limite: 20,
      restantes: 16,
      percentual: 20,
      profissionais_utilizados: 1,
      limite_profissionais: 1,
      servicos_utilizados: 2,
      limite_servicos: 4
    },
    pagamentos: [
      {
        id: 101,
        valor: 49.9,
        forma_pagamento: "pix",
        status: "RECEIVED",
        data_pagamento: "2026-09-23"
      }
    ]
  }));

  await page.goto("/painel/assinatura");

  await expect(page.getByRole("heading", {
    name: "Plano e assinatura"
  })).toBeVisible();
  await expect(page.getByText("Renovação cancelada")).toBeVisible();
  await expect(page.getByText("Acesso até")).toBeVisible();
  await expect(page.getByText("Próxima cobrança")).toHaveCount(0);
  await expect(page.getByRole("button", {
    name: "Cancelar renovação"
  })).toHaveCount(0);
  await expect(
    page.locator(".billing-effective-plan")
  ).toContainText("Autônoma");
  await expectNoHorizontalOverflow(page);
});

test("cobrança atrasada oferece fatura segura e a recuperação restaura o plano pago", async ({ page }) => {
  await prepareOwner(page);

  let recovered = false;

  await page.route("**/minha-assinatura", (route) => {
    if (!recovered) {
      return json(route, {
        plano: FREE_PLAN,
        assinatura: null,
        estado_assinatura: {
          codigo: "FALHA_DE_PAGAMENTO",
          tipo_falha: "COBRANCA_ATRASADA",
          status_provedor: "OVERDUE",
          assinatura_id: 92,
          plano_id: PAID_PLAN.id
        },
        upgrade_pendente: null,
        pagamento_recuperavel: {
          id: 102,
          status: "OVERDUE",
          data_vencimento: "2026-09-23",
          invoice_url:
            "https://www.asaas.com/i/regularizar-wave20"
        },
        uso: {
          plano_id: FREE_PLAN.id,
          plano_nome: FREE_PLAN.nome,
          plano_slug: FREE_PLAN.slug,
          utilizados: 4,
          limite: 10,
          restantes: 6,
          percentual: 40,
          profissionais_utilizados: 1,
          limite_profissionais: 1,
          servicos_utilizados: 2,
          limite_servicos: 2
        },
        pagamentos: [
          {
            id: 102,
            valor: 49.9,
            forma_pagamento: "pix",
            status: "OVERDUE",
            data_vencimento: "2026-09-23"
          }
        ]
      });
    }

    return json(route, {
      plano: PAID_PLAN,
      assinatura: {
        id: 92,
        status: "ACTIVE",
        ativo: true,
        forma_pagamento: "pix",
        data_proxima_cobranca: "2026-10-23"
      },
      estado_assinatura: {
        codigo: "ATIVA",
        status_provedor: "ACTIVE",
        assinatura_id: 92,
        plano_id: PAID_PLAN.id
      },
      upgrade_pendente: null,
      pagamento_recuperavel: null,
      uso: {
        plano_id: PAID_PLAN.id,
        plano_nome: PAID_PLAN.nome,
        plano_slug: PAID_PLAN.slug,
        utilizados: 4,
        limite: 20,
        restantes: 16,
        percentual: 20,
        profissionais_utilizados: 1,
        limite_profissionais: 1,
        servicos_utilizados: 2,
        limite_servicos: 4
      },
      pagamentos: [
        {
          id: 102,
          valor: 49.9,
          forma_pagamento: "pix",
          status: "RECEIVED",
          data_pagamento: "2026-09-23"
        }
      ]
    });
  });

  await page.goto("/painel/assinatura");

  await expect(page.getByText("Pagamento em atraso")).toBeVisible();
  const recoveryLink = page.getByRole("link", {
    name: "Regularizar no Asaas"
  });
  await expect(recoveryLink).toHaveAttribute(
    "href",
    "https://www.asaas.com/i/regularizar-wave20"
  );
  await expect(recoveryLink).toHaveAttribute("target", "_blank");
  await expect(
    page.locator(".billing-effective-plan")
  ).toContainText("Grátis");
  await expect(page.getByRole("table")).toContainText("Atrasado");
  await expectNoHorizontalOverflow(page);

  recovered = true;
  await page.reload();

  await expect(page.getByText("Assinatura ativa")).toBeVisible();
  await expect(page.getByText("Pagamento em atraso")).toHaveCount(0);
  await expect(page.getByRole("link", {
    name: "Regularizar no Asaas"
  })).toHaveCount(0);
  await expect(
    page.locator(".billing-effective-plan")
  ).toContainText("Autônoma");
  await expect(page.getByRole("table")).toContainText("Pago");
  await expectNoHorizontalOverflow(page);
});
