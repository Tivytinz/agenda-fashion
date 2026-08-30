import { expect, test } from "@playwright/test";

const USER = {
  id: 4,
  nome: "Ana Profissional",
  email: "ana@example.com",
  whatsapp: "62999999999"
};

const BUSINESS = {
  id: 11,
  slug: "studio-aurora",
  nome: "Studio Aurora",
  descricao: "Beleza com atendimento personalizado.",
  whatsapp: "62999999999",
  whatsapp_negocio: "62999999999",
  cidade: "Goiânia",
  estado: "GO",
  bairro: "Centro",
  endereco: "Rua das Flores",
  numero: "10",
  complemento: "",
  cep: "74000123",
  localizacao_url: "https://maps.google.com/?q=goiania",
  areas: ["Unhas"],
  papel: "dono",
  publicado: false
};

const SERVICE = {
  id: 21,
  nome: "Design + Henna",
  descricao: "",
  categoria: "unha",
  valor: 40,
  duracao_minutos: 60,
  ativo: true
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

function scheduleDays() {
  return Array.from({ length: 7 }, (_, day) => ({
    dia_semana: day,
    trabalha: day === 1,
    hora_inicio: day === 1 ? "09:00" : "08:00",
    hora_fim: day === 1 ? "18:00" : "18:00",
    intervalo_inicio: "",
    intervalo_fim: ""
  }));
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

test("profissional vai da landing até agenda pronta para divulgação", async ({ page }) => {
  let businessCreated = false;
  let serviceCreated = false;
  let scheduleConfigured = false;
  let registrationPayload = null;
  let businessPayload = null;
  let servicePayload = null;
  let schedulePayload = null;

  await page.addInitScript(() => {
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-08-30T00:00:00.000Z"
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

  await page.route("**/cadastro", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    registrationPayload = route.request().postDataJSON();
    await json(route, {
      token: "activation-e2e-token",
      usuario: USER,
      contaCriada: true
    }, 201);
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: USER,
    negocio: businessCreated
      ? {
          ...BUSINESS,
          publicado: serviceCreated
        }
      : null,
    temNegocio: businessCreated,
    administrador: null,
    ehAdministrador: false
  }));

  await page.route("**/cep/74000123", (route) => json(route, {
    cep: "74000123",
    endereco: "Rua das Flores",
    bairro: "Centro",
    cidade: "Goiânia",
    estado: "GO"
  }));

  await page.route("**/criar-negocio", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    businessPayload = route.request().postDataJSON();
    businessCreated = true;
    await json(route, {
      mensagem: "Negócio criado.",
      negocio: BUSINESS
    }, 201);
  });

  await page.route("**/dashboard-dono?periodo=7dias", (route) => json(route, {
    resumo: {
      agendamentos_periodo: 0,
      faturamento_periodo: 0,
      clientes_novos: 0
    },
    performance: {
      visitas_perfil: 0,
      agendamentos_concluidos: 0,
      taxa_conversao: 0
    },
    ranking_servicos: [],
    ativacao: {
      negocio_publicado: serviceCreated,
      agenda_configurada: scheduleConfigured,
      primeiro_agendamento_recebido: false
    }
  }));
  await page.route("**/dashboard-dono/origem-clientes?periodo=7dias", (route) => json(route, {
    resumo: {},
    origens: []
  }));
  await page.route("**/conta", (route) => json(route, {
    usuario: {
      ...USER,
      aceita_lembretes_whatsapp: true,
      aceita_alertas_operacionais_whatsapp: true
    }
  }));

  await page.route("**/configuracoes", (route) => json(route, {
    negocio: {
      ...BUSINESS,
      publicado: serviceCreated
    },
    publicacao: serviceCreated
      ? {
          publicado: true,
          pode_publicar: true,
          pendencias: []
        }
      : {
          publicado: false,
          pode_publicar: false,
          pendencias: ["pelo menos um serviço ativo"]
        }
  }));

  await page.route("**/agenda-configuracao/status", (route) => json(route, {
    configurada: scheduleConfigured,
    configurado_em: scheduleConfigured
      ? "2026-08-30T12:00:00.000Z"
      : null
  }));

  await page.route("**/servicos", async (route) => {
    if (route.request().method() !== "POST") {
      await json(route, { servicos: serviceCreated ? [SERVICE] : [] });
      return;
    }

    servicePayload = route.request().postDataJSON();
    serviceCreated = true;
    await json(route, {
      mensagem: "Serviço criado.",
      servico: SERVICE,
      publicacao: {
        publicado: true,
        pode_publicar: true,
        pendencias: []
      }
    }, 201);
  });

  await page.route("**/agenda-configuracao", async (route) => {
    if (route.request().method() === "PUT") {
      schedulePayload = route.request().postDataJSON();
      scheduleConfigured = true;
      await json(route, {
        mensagem: "Horários atualizados.",
        configuracao: {
          duracao_padrao: 60,
          intervalo_minutos: 0,
          antecedencia_agendamento: 0,
          antecedencia_cancelamento: 24,
          configurado_em: "2026-08-30T12:00:00.000Z"
        }
      });
      return;
    }

    await json(route, {
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24,
        configurado_em: null
      },
      horarios: scheduleDays()
    });
  });

  await page.goto("/para-profissionais");
  await page.getByRole("link", { name: "Criar minha agenda grátis" }).first().click();

  await expect(page).toHaveURL(/\/cadastro\?tipo=profissional/);
  await page.getByLabel("Nome completo").fill("Ana Profissional");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByLabel("WhatsApp com DDD").fill("62 99999-9999");
  await page.getByLabel("Senha").fill("senha-e2e-123");
  await page.getByLabel("Confirme a senha").fill("senha-e2e-123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/criar-negocio$/);
  expect(registrationPayload).toEqual(expect.objectContaining({
    nome: "Ana Profissional",
    email: "ana@example.com",
    whatsapp: "62999999999",
    aceitaNotificacoesWhatsapp: false
  }));

  await expect(page.getByRole("heading", { name: "Crie seu negócio" })).toBeVisible();
  await page.getByLabel("Nome do negócio").fill("Studio Aurora");
  await page.getByLabel("Descrição").fill("Beleza com atendimento personalizado.");
  await page.getByLabel("Unhas").check();
  await expect(page.getByLabel("WhatsApp")).toHaveValue("(62) 99999-9999");
  await page.getByLabel("Link do Google Maps").fill("https://maps.google.com/?q=goiania");
  await page.getByLabel("CEP").fill("74000-123");
  await expect(page.getByLabel("Endereço")).toHaveValue("Rua das Flores");
  await expect(page.getByLabel("Cidade")).toHaveValue("Goiânia");
  await page.getByLabel("Número").fill("10");
  await expect(page.getByLabel("Complemento (opcional)")).toHaveValue("");
  await page.getByRole("button", { name: "Criar negócio" }).click();

  await expect(page).toHaveURL(/\/painel$/);
  expect(businessPayload).toEqual(expect.objectContaining({
    nome: "Studio Aurora",
    descricao: "Beleza com atendimento personalizado.",
    especialidades: ["Unhas"],
    whatsapp: "62999999999",
    complemento: "",
    cep: "74000123"
  }));

  await expect(page.getByRole("heading", {
    name: "Prepare seu negócio para receber agendamentos"
  })).toBeVisible();
  await page.getByRole("link", { name: "Cadastrar serviço" }).click();

  await expect(page).toHaveURL(/\/painel\/servicos\/novo$/);
  await page.getByLabel("Nome do serviço").fill("Design + Henna");
  await page.getByLabel("Categoria").selectOption("unha");
  await page.getByLabel("Valor").fill("40");
  await page.getByLabel("Duração em minutos").fill("60");
  await page.getByRole("button", { name: "Salvar serviço" }).click();

  await expect(page).toHaveURL(/\/painel\/horarios$/);
  expect(servicePayload).toEqual(expect.objectContaining({
    nome: "Design + Henna",
    categoria: "unha",
    valor: 40,
    duracao_minutos: 60,
    ativo: true
  }));

  await expect(page.getByRole("heading", {
    name: "Confirme quando você atende"
  })).toBeVisible();
  await expect(page.locator("details.schedule-advanced-settings")).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Início do atendimento de Segunda")).toHaveValue("09:00");
  await expect(page.getByLabel("Fim do atendimento de Segunda")).toHaveValue("18:00");
  await page.getByRole("button", { name: "Salvar horários" }).click();

  await expect(page.getByRole("heading", {
    name: "Agora divulgue seu perfil"
  })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar perfil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

  expect(schedulePayload).not.toBeNull();
  expect(schedulePayload.horarios).toEqual(expect.arrayContaining([
    expect.objectContaining({
      diaSemana: 1,
      trabalha: true,
      horaInicio: "09:00",
      horaFim: "18:00"
    })
  ]));

  await expectNoHorizontalOverflow(page);
});
