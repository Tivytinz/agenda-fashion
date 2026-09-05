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

async function setupAdmin(page) {
  await page.addInitScript(() => {
    localStorage.setItem("token", "admin-operational-e2e");
    localStorage.setItem("usuario", JSON.stringify({ id: 9, nome: "Admin AF" }));
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: { id: 9, nome: "Admin AF", email: "admin@example.com" },
    negocio: null,
    temNegocio: false,
    administrador: { usuarioId: 9 },
    ehAdministrador: true
  }));
  await page.route("**/marketing/meta/config", (route) => json(route, { enabled: false }));
  await page.route("**/marketing/meta/consentimento", (route) => json(route, { consentimento: false }));
}

test("ativação usa deep link e vira cartões sem overflow no celular", async ({ page }) => {
  await setupAdmin(page);
  await page.route("**/admin/saude/perfis-incompletos**", (route) => json(route, {
    resumo: {
      totalProfissionais: 8,
      totalIncompletos: 5,
      semNegocio: 1,
      perfilIncompleto: 1,
      semServico: 2,
      semAgenda: 5,
      naoPublicados: 3
    },
    perfis: [{
      usuarioId: 42,
      nome: "Ana Souza",
      email: "ana@example.com",
      whatsapp: "11987654321",
      whatsappAutorizado: true,
      cadastroEm: "2026-09-01T12:00:00.000Z",
      ultimaAtividadeEm: "2026-09-04T12:00:00.000Z",
      negocio: { nome: "Studio Ana", cidade: "São Paulo", estado: "SP", publicado: false },
      progresso: { etapasConcluidas: 3, percentual: 60, etapasRestantes: 2 },
      proximaAcao: { codigo: "agenda", rotulo: "Configurar agenda" },
      pendencias: [{ codigo: "agenda", rotulo: "Configurar agenda" }]
    }],
    paginacao: { pagina: 1, limite: 25, total: 1, totalPaginas: 1 }
  }));

  await page.goto("/admin/saude?pendencia=agenda");
  await expect(page.getByRole("heading", { name: "Ativação profissional" })).toBeVisible();
  await expect(page.getByLabel("Filtrar por pendência")
    .getByRole("button", { name: "Sem agenda", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Ana Souza")).toBeVisible();
  await expect(page.getByText("Configurar agenda")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("WhatsApp transforma tabela em cartões sem perder semântica", async ({ page }) => {
  await setupAdmin(page);
  await page.route("**/admin/whatsapp/templates**", (route) => json(route, {
    configuracao: { notificacoesHabilitadas: true },
    verificacaoMeta: {
      disponivel: true,
      codigo: "CONSULTA_CONCLUIDA",
      mensagem: "Status consultado diretamente na Meta.",
      consultadoEm: "2026-09-05T12:00:00.000Z",
      variaveisAusentes: []
    },
    resumo: {
      templatesEsperados: 1,
      templatesAprovadosMeta: 1,
      automacoesHabilitadas: 1,
      total: 10,
      aceitas: 8,
      entregues: 6,
      lidas: 3,
      taxaEntrega: 75,
      taxaLeitura: 50
    },
    templates: [{
      tipo: "CONFIRMACAO_AGENDAMENTO_CLIENTE",
      rotulo: "Confirmação para a cliente",
      nome: "confirmacao_agendamento_cliente",
      destinatario: "Cliente",
      idioma: "pt_BR",
      automacaoHabilitada: true,
      statusMeta: "APPROVED",
      categoriaMeta: "UTILITY",
      categoriaConforme: true,
      qualidadeMeta: "GREEN",
      metricas: {
        total: 10,
        aceitas: 8,
        entregues: 6,
        lidas: 3,
        pendentes: 1,
        canceladas: 0,
        falhasFila: 0,
        falhasEntrega: 0,
        taxaEntrega: 75,
        taxaLeitura: 50
      }
    }]
  }));

  await page.goto("/admin/whatsapp?periodo=30");
  await expect(page.getByRole("heading", { name: "WhatsApp e automações" })).toBeVisible();
  await expect(page.getByText("Confirmação para a cliente")).toBeVisible();
  await expect(page.getByText("8 de 10 · 80%")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("operação pesquisa no servidor e preserva privacidade do cliente", async ({ page }) => {
  await setupAdmin(page);
  await page.route("**/admin/negocios?**", (route) => json(route, {
    negocios: [{
      id: 1,
      nome: "Studio Aurora",
      slug: "studio-aurora",
      cidade: "Goiânia",
      bairro: "Centro",
      ativo: true,
      total_profissionais: 2,
      total_servicos: 4,
      total_agendamentos: 12
    }],
    paginacao: { pagina: 1, limite: 25, total: 1, totalPaginas: 1 }
  }));
  await page.route("**/admin/agendamentos?**", (route) => json(route, {
    agendamentos: [{
      id: 7,
      data: "2026-09-05",
      horario: "14:00",
      status: "cancelado",
      cliente_nome: "Maria",
      negocio: "Studio Aurora",
      servico: "Manicure",
      profissional: "Ana"
    }],
    paginacao: { pagina: 1, limite: 25, total: 1, totalPaginas: 1 }
  }));

  await page.goto("/admin/operacao");
  await expect(page.getByText("Studio Aurora")).toBeVisible();
  await page.getByRole("button", { name: "Agendamentos" }).click();
  await expect(page.getByText("Maria")).toBeVisible();
  await expect(page.getByRole("region", { name: "Agendamentos da plataforma" })
    .getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(page.getByText("62999999999")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
