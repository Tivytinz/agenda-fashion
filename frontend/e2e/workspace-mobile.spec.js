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

const PROFESSIONAL_BUSINESS = {
  ...BUSINESS,
  id: 22,
  slug: "studio-parceiro",
  nome: "Studio Parceiro",
  papel: "profissional"
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
    localStorage.setItem("session_active", "1");
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
  const navigationBox = await navigation.boundingBox();
  expect(navigationBox.x).toBeGreaterThanOrEqual(0);
  expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(page.viewportSize().width);
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

  await page.route("**/servicos", (route) => json(route, []));
  await page.route("**/minha-assinatura", (route) => json(route, {}));
  await navigation.getByRole("link", { name: /Serviços/ }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Sair sem salvar?" });
  await expect(leaveDialog).toBeVisible();
  await expect(leaveDialog.getByRole("button", { name: "Continuar editando" })).toBeFocused();
  await leaveDialog.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Studio Aurora atualizado");
  await navigation.getByRole("link", { name: /Serviços/ }).click();
  await expect(leaveDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(leaveDialog).not.toBeVisible();
  await navigation.getByRole("link", { name: /Serviços/ }).click();
  await leaveDialog.getByRole("button", { name: "Sair sem salvar" }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
  await navigation.getByRole("button", { name: "Abrir mais opções da área de trabalho" }).click();
  await navigation.getByRole("link", { name: /Meu negócio/ }).click();
  await page.getByLabel("Nome do negócio").fill("Edição no histórico");
  await page.evaluate(() => history.back());
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page).toHaveURL(/\/painel\/negocio$/);
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Edição no histórico");
  await page.evaluate(() => history.back());
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Sair sem salvar" }).click();
  await expect(page).toHaveURL(/\/painel\/servicos$/);
});

test("próxima ação de ativação cabe no celular e mostra somente a missão atual", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
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
        rotulo: "Cadastrar primeiro serviço",
        destino: "/painel/servicos/novo?onboarding=servico"
      }
    }
  }));
  await page.goto("/painel");

  await expect(page.getByRole("heading", {
    name: "Ative seus serviços"
  })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cadastrar primeiro serviço" }))
    .toBeVisible();
  await expect(page.getByText(/etapas concluídas/i)).toHaveCount(0);
  await expect(page.getByLabel(/progresso da ativação/i)).toHaveCount(0);

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
});

for (const scenario of [
  {
    name: "pouca amostra",
    title: "Continue cuidando do seu negócio",
    action: "Abrir agenda",
    destination: /\/painel\/agenda$/,
    insight: { status: "DADOS_INSUFICIENTES", oportunidade_principal: null }
  },
  {
    name: "sem disponibilidade",
    title: "Revise os horários antes de divulgar",
    action: "Revisar horários",
    destination: /\/painel\/horarios$/,
    insight: {
      status: "OPORTUNIDADE_PRIORIZADA",
      oportunidade_principal: {
        codigo: "REVISAR_DISPONIBILIDADE",
        categoria: "operacao",
        titulo: "Revise os horários antes de divulgar",
        mensagem: "Se a pausa for intencional, mantenha sua configuração.",
        acao: { tipo: "NAVEGAR", rotulo: "Revisar horários", destino: "/painel/horarios" }
      }
    }
  },
  {
    name: "primeira reserva sem horários",
    title: "Adicione horários para receber agendamentos",
    action: "Configurar horários",
    destination: /\/painel\/horarios$/,
    activation: { primeiro_agendamento_recebido: false, possui_disponibilidade_agendavel: false, possui_servico_ativo: true },
    nextAction: {
      estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO", concluido: false,
      titulo: "Adicione horários para receber agendamentos",
      mensagem: "Revise os dias e horários antes de divulgar.",
      acao: { tipo: "NAVEGAR", rotulo: "Configurar horários", destino: "/painel/horarios" }
    },
    insight: { status: "AGUARDANDO_ATIVACAO", oportunidade_principal: null }
  },
  {
    name: "serviço sem profissional habilitada",
    title: "Habilite uma profissional para seus serviços",
    action: "Gerenciar serviços da equipe",
    destination: /\/painel\/profissionais$/,
    activation: { possui_disponibilidade_agendavel: false, motivo_indisponibilidade: "SEM_PROFISSIONAL_HABILITADA" },
    insight: {
      status: "OPORTUNIDADE_PRIORIZADA",
      oportunidade_principal: {
        codigo: "REVISAR_DISPONIBILIDADE", categoria: "operacao",
        titulo: "Habilite uma profissional para seus serviços",
        mensagem: "Revise os serviços oferecidos pela equipe antes de divulgar.",
        acao: { tipo: "NAVEGAR", rotulo: "Gerenciar serviços da equipe", destino: "/painel/profissionais" }
      }
    }
  },
  {
    name: "perfil oculto",
    title: "Seu perfil está oculto",
    action: "Gerenciar publicação",
    destination: /\/painel\/negocio$/,
    activation: { negocio_publicado: false, publicacao_pausada_manualmente: true },
    nextAction: {
      estado: "REVISAR_PUBLICACAO",
      concluido: false,
      titulo: "Seu perfil está oculto",
      mensagem: "Você escolheu ocultar o perfil. Essa escolha continua valendo.",
      acao: { tipo: "NAVEGAR", rotulo: "Gerenciar publicação", destino: "/painel/negocio" }
    },
    insight: { status: "AGUARDANDO_ATIVACAO", oportunidade_principal: null }
  }
]) {
  test(`orientação do painel com ${scenario.name} cabe no celular`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("session_active", "1"));
    await page.route("**/minha-sessao", route => json(route, {
      usuario: { id: 4, nome: "Ana", email: "ana@example.com" },
      negocio: { ...BUSINESS, publicado: scenario.activation?.negocio_publicado ?? true },
      temNegocio: true,
      administrador: null,
      ehAdministrador: false
    }));
    await page.route("**/marketing/meta/config", route => json(route, { enabled: false }));
    await page.route("**/marketing/google/config", route => json(route, { enabled: false }));
    await page.route("**/minha-assinatura", route => json(route, {}));
    await page.route("**/profissionais", route => json(route, { profissionais: [] }));
    await page.route("**/conta", route => json(route, {
      usuario: { aceita_lembretes_whatsapp: false, aceita_alertas_operacionais_whatsapp: true }
    }));
    await page.route("**/dashboard-dono/origem-clientes?periodo=7dias", route => json(route, { resumo: {}, origens: [] }));
    await page.route("**/dashboard-dono?periodo=7dias", route => json(route, {
      resumo: {}, performance: {}, ranking_servicos: [],
      negocio: { negocio_id: 11, nome: BUSINESS.nome, slug: BUSINESS.slug },
      ativacao: { negocio_publicado: true, primeiro_agendamento_recebido: true, ...scenario.activation },
      proxima_acao_ativacao: scenario.nextAction || { estado: "ATIVADO", concluido: true },
      inteligencia_crescimento: scenario.insight
    }));
    await page.goto("/painel");
    const guidance = page.locator("section.dashboard-action-panel").filter({
      has: page.getByRole("heading", { name: scenario.title, exact: true })
    });
    await expect(guidance).toBeVisible();
    const today = page.getByRole("region", { name: "Agenda de hoje" });
    await expect(today).toBeVisible();
    const agendaBox = await today.boundingBox();
    const guidanceBox = await guidance.boundingBox();
    if (scenario.activation?.primeiro_agendamento_recebido === false) {
      expect(guidanceBox.y + guidanceBox.height).toBeLessThanOrEqual(agendaBox.y);
    } else {
      expect(agendaBox.y + agendaBox.height).toBeLessThanOrEqual(guidanceBox.y);
    }
    await expect(page.getByRole("button", { name: "Ativar lembretes no WhatsApp" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Ativação concluída" })).toHaveCount(0);
    await expect(guidance.getByRole("button", { name: /Compartilhar|Criar texto/i })).toHaveCount(0);
    const action = guidance.getByRole("link", { name: scenario.action });
    await action.scrollIntoViewIfNeeded();
    await action.focus();
    await expect(action).toBeFocused();
    const diagnostics = await horizontalOverflowDiagnostics(page);
    expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);
    await action.click();
    await expect(page).toHaveURL(scenario.destination);
    if (scenario.action === "Gerenciar serviços da equipe") {
      await expect(page.getByRole("heading", { name: "Profissionais", exact: true })).toBeVisible();
    }
  });
}

test("ProfessionalShell mantém rotina curta, foco visível e sem overflow no celular", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("usuario", JSON.stringify({ id: 8, nome: "Bia" }));
    localStorage.setItem("negocio", JSON.stringify({
      id: 11,
      nome: "Studio Aurora",
      papel: "profissional"
    }));
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-08-11T00:00:00.000Z"
    }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 8, nome: "Bia", email: "bia@example.com" },
    negocio: BUSINESS,
    vinculos: [
      BUSINESS,
      PROFESSIONAL_BUSINESS
    ],
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
  await page.route("**/agenda-profissional", (route) => json(route, {
    agenda: []
  }));
  await page.route("**/conta", (route) => json(route, {
    usuario: {
      id: 8,
      nome: "Bia",
      email: "bia@example.com",
      whatsapp: "62999998888",
      aceita_lembretes_whatsapp: false,
      aceita_notificacoes_whatsapp: true,
      aceita_alertas_operacionais_whatsapp: true
    }
  }));

  await page.goto("/profissional/agenda");

  await expect(page.locator('[data-frontend-context="professional"]')).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "Minha agenda"
  })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Rotina profissional" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Minha agenda/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Meus horários/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Minha conta/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Convites/ })).toHaveCount(0);
  await expect(
    page.locator(".professional-topbar-context").getByText("Studio Parceiro")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Ir para gestão/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Equipe/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Plano e assinatura/ })).toHaveCount(0);

  const scheduleLink = navigation.getByRole("link", { name: /Meus horários/ });
  await scheduleLink.focus();
  await expect.poll(() => scheduleLink.evaluate((element) => (
    getComputedStyle(element).outlineStyle
  ))).not.toBe("none");

  const emptyAction = page.getByRole("link", { name: "Ajustar meus horários" });
  const mobileNavigation = page.locator(".professional-shell > .workspace-mobile-nav");
  await expect(emptyAction).toBeVisible();
  await expect(mobileNavigation).toBeVisible();

  await emptyAction.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const [actionBox, navigationBox] = await Promise.all([
      emptyAction.boundingBox(),
      mobileNavigation.boundingBox()
    ]);

    return Boolean(
      actionBox &&
      navigationBox &&
      actionBox.y + actionBox.height <= navigationBox.y
    );
  }).toBe(true);

  const diagnostics = await horizontalOverflowDiagnostics(page);
  expect(diagnostics.scrollWidth).toBe(diagnostics.clientWidth);

  await navigation.getByRole("link", { name: /Minha conta/ }).click();
  await expect(page).toHaveURL(/\/profissional\/conta$/);
  await expect(page.locator('[data-frontend-context="professional"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minha conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver convites" })).toBeVisible();
});


test("sessão expirada sai do workspace sem manter conteúdo operacional obsoleto", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
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
  await page.route("**/configuracoes", (route) => route.request().method() === "PUT"
    ? json(route, { erro: "Sessão expirada" }, 401)
    : json(route, { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } }));

  await page.goto("/painel/negocio");
  await page.getByLabel("Nome do negócio").fill("Edição com sessão expirada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("dialog", { name: "Sair sem salvar?" })).toHaveCount(0);
  await expect(page.locator('[data-frontend-context="owner"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Entre no Agenda Fashion" })).toBeVisible();
});
