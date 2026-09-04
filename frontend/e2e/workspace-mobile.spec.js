import { expect, test } from "@playwright/test";

const BUSINESS = {
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

async function horizontalOverflowDiagnostics(page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const classes = Array.from(element.classList)
          .slice(0, 4)
          .map((name) => `.${name}`)
          .join("");

        return {
          selector: `${element.tagName.toLowerCase()}${classes}`,
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          display: style.display,
          position: style.position,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth
        };
      })
      .filter((element) => (
        element.left < -0.5 ||
        element.right > clientWidth + 0.5 ||
        element.scrollWidth > element.clientWidth + 1
      ));

    return { clientWidth, scrollWidth, offenders };
  });
}

test("ações do negócio ficam acima da navegação e mantêm foco visível", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "owner-e2e");
    localStorage.setItem("usuario", JSON.stringify({ id: 4, nome: "Ana" }));
    localStorage.setItem("negocio", JSON.stringify({
      id: 11,
      nome: "Studio Aurora",
      papel: "dono"
    }));
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-08-11T00:00:00.000Z"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 4, nome: "Ana", email: "ana@example.com" },
    negocio: BUSINESS,
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
  await page.route("**/configuracoes", (route) => json(route, {
    negocio: BUSINESS,
    publicacao: {
      publicado: true,
      pode_publicar: true,
      pendencias: []
    }
  }));

  await page.goto("/painel/negocio");
  await page.getByLabel("Nome do negócio").fill("Studio Aurora atualizado");

  const save = page.getByRole("button", { name: "Salvar alterações" });
  const navigation = page.getByRole("navigation", {
    name: "Área de trabalho"
  });

  await expect(save).toBeVisible();
  await expect(navigation).toBeVisible();
  await save.scrollIntoViewIfNeeded();

  await expect.poll(async () => {
    const [saveBox, navigationBox] = await Promise.all([
      save.boundingBox(),
      navigation.boundingBox()
    ]);

    return Boolean(
      saveBox &&
      navigationBox &&
      saveBox.y + saveBox.height <= navigationBox.y
    );
  }).toBe(true);

  await save.focus();
  await expect.poll(() => save.evaluate((element) => (
    getComputedStyle(element).outlineStyle
  ))).not.toBe("none");

  try {
    await expect.poll(() => page.evaluate(() => (
      document.documentElement.scrollWidth ===
      document.documentElement.clientWidth
    ))).toBe(true);
  } catch (error) {
    const diagnostics = await horizontalOverflowDiagnostics(page);
    throw new Error(
      `${error.message}\n\nHorizontal overflow diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`
    );
  }
});

test("próxima ação de ativação cabe no celular e mostra somente a missão atual", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "owner-e2e");
    localStorage.setItem("usuario", JSON.stringify({ id: 4, nome: "Ana" }));
    localStorage.setItem("negocio", JSON.stringify({
      id: 11,
      nome: "Studio Aurora",
      papel: "dono"
    }));
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-08-11T00:00:00.000Z"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 4, nome: "Ana", email: "ana@example.com" },
    negocio: { ...BUSINESS, publicado: false },
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
  await page.route("**/dashboard-dono?periodo=7dias", (route) => json(route, {
    resumo: {},
    performance: {},
    ranking_servicos: [],
    negocio: {
      negocio_id: 11,
      nome: "Studio Aurora",
      slug: "studio-aurora"
    },
    ativacao: {
      possui_servico_ativo: false,
      agenda_configurada: false,
      negocio_publicado: false,
      primeiro_agendamento_recebido: false
    },
    proxima_acao_ativacao: {
      estado: "GARANTIR_SERVICO_ATIVO",
      concluido: false,
      titulo: "Ative seus serviços",
      mensagem: "Mantenha pelo menos um serviço ativo para receber novos agendamentos.",
      acao: {
        tipo: "NAVEGAR",
        rotulo: "Gerenciar serviços",
        destino: "/painel/servicos"
      }
    }
  }));
  await page.goto("/painel");

  await expect(page.getByRole("heading", {
    name: "Ative seus serviços"
  })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gerenciar serviços" }))
    .toBeVisible();
  await expect(page.getByText("0 de 4 etapas concluídas")).toBeVisible();

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});
