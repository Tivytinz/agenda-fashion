import { expect, test } from "@playwright/test";

const USER = {
  id: 31,
  nome: "Cliente Recorrente",
  email: "cliente@example.com",
  whatsapp: "62999998888",
  aceita_notificacoes_whatsapp: false
};

const PROFILE = {
  negocio: {
    id: 7,
    nome: "Studio Aurora",
    descricao: "Beleza com hora marcada",
    whatsapp: "11999999999",
    bairro: "Centro",
    cidade: "São Paulo",
    estado: "SP"
  },
  servicos: [
    {
      id: 11,
      nome: "Manicure completa",
      descricao: "Cuidado completo para as unhas",
      duracao_minutos: 60,
      valor: 50
    }
  ],
  profissionais: [
    {
      id: 21,
      nome: "Ana",
      servico_ids: [11]
    }
  ]
};

const AVAILABILITY = [
  {
    data: "2026-09-25",
    horarios: ["09:00", "10:00", "11:00"]
  }
];

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

test("cliente repete um serviço e cria um novo booking sem fixar a profissional anterior", async ({ page }) => {
  const analyticsPayloads = [];
  const legacyEvents = [];
  let bookingPayload = null;

  await page.addInitScript(() => {
    localStorage.setItem("session_active", "1");
    localStorage.setItem("usuario", JSON.stringify({
      id: 31,
      nome: "Cliente Recorrente",
      email: "cliente@example.com",
      whatsapp: "62999998888",
      aceita_notificacoes_whatsapp: false
    }));
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-09-23T00:00:00.000Z"
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
  await page.route("**/marketing/google/consentimento", (route) => json(route, {
    consentimento: false
  }));
  await page.route("**/analytics/collect", async (route) => {
    analyticsPayloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/eventos-produto", async (route) => {
    legacyEvents.push(route.request().postDataJSON());
    await json(route, { recebido: true }, 201);
  });

  await page.route("**/minha-sessao", (route) => json(route, {
    usuario: USER,
    negocio: null,
    vinculos: [],
    temNegocio: false,
    administrador: null,
    ehAdministrador: false
  }));

  await page.route("**/meus-agendamentos", (route) => json(route, {
    agendamentos: [
      {
        id: 401,
        negocio_id: 7,
        servico_id: 11,
        profissional_id: 99,
        negocio: "Studio Aurora",
        slug: "studio-aurora",
        servico: "Manicure completa",
        profissional: "Profissional anterior",
        data: "2026-09-10",
        horario: "09:00",
        valor: 50,
        status: "realizado",
        avaliacao: 5
      }
    ]
  }));

  await page.route("**/perfil-negocio/studio-aurora", (route) => json(route, PROFILE));
  await page.route("**/favoritos/7/status", (route) => json(route, {
    favoritado: false
  }));
  await page.route("**/agenda-publica?**", (route) => json(route, {
    disponibilidade: AVAILABILITY
  }));
  await page.route("**/agenda-publica/politica-cancelamento?**", (route) => json(route, {
    politica_cancelamento: {
      antecedencia_horas: 24
    }
  }));
  await page.route("**/agendamentos", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }

    bookingPayload = route.request().postDataJSON();
    await json(route, {
      agendamento: {
        id: 402,
        cliente_nome: USER.nome,
        cliente_whatsapp: USER.whatsapp,
        data: "2026-09-25",
        horario: "09:00",
        status: "agendado"
      }
    }, 201);
  });

  await page.goto("/minha-agenda");

  await page.getByRole("tab", { name: /Realizados/ }).click();
  await expect(page.getByText("Manicure completa")).toBeVisible();

  const repeatButton = page.getByRole("link", {
    name: "Agendar novamente"
  });
  await expect(repeatButton).toHaveAttribute(
    "href",
    "/negocio/studio-aurora?servico=11&origem=meus_agendamentos"
  );
  await repeatButton.click();

  await expect(page).toHaveURL(/\/negocio\/studio-aurora\?/);
  await expect.poll(() => new URL(page.url()).searchParams.get("servico"))
    .toBe("11");
  await expect.poll(() => new URL(page.url()).searchParams.get("origem"))
    .toBe("meus_agendamentos");
  await expect.poll(() => new URL(page.url()).searchParams.get("profissional"))
    .toBe("21");
  expect(new URL(page.url()).searchParams.get("profissional")).not.toBe("99");

  await expect.poll(() => legacyEvents.some((event) => (
    event?.nome === "agendamento_iniciado" &&
    event?.pagina === "meus_agendamentos" &&
    event?.propriedades?.origem === "agendar_novamente" &&
    event?.propriedades?.agendamento_id === 401
  ))).toBe(true);

  await expect.poll(() => analyticsPayloads.some((payload) => (
    payload?.items?.some((item) => (
      item?.type === "event" &&
      item?.name === "booking_started" &&
      item?.properties?.intent === "repeat_booking" &&
      item?.properties?.entry_point === "customer_agenda" &&
      item?.properties?.source_booking_status === "realizado"
    ))
  ))).toBe(true);

  await expect(page.getByText("Manicure completa", {
    exact: true
  }).first()).toBeVisible();
  await expect(page.getByText("Ana", {
    exact: true
  }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "09:00" }).click();
  await page.getByRole("button", {
    name: "Revisar e confirmar"
  }).click();

  await expect(page).toHaveURL(/\/confirmar$/);
  await expect(page.getByRole("heading", {
    name: "Confirme seus dados"
  })).toBeVisible();
  await expect(page.getByText(USER.nome)).toBeVisible();
  await expect(page.getByText("(62) 99999-8888")).toBeVisible();

  await page.getByRole("button", {
    name: "Confirmar agendamento"
  }).click();

  await expect(page).toHaveURL(/\/sucesso$/);
  await expect(page.getByRole("heading", {
    name: "Agendamento confirmado"
  })).toBeVisible();
  await expect(page.getByText(
    /Manicure completa com Ana/
  )).toBeVisible();

  expect(bookingPayload).toEqual(expect.objectContaining({
    slug: "studio-aurora",
    servico_id: 11,
    profissional_id: 21,
    data: "2026-09-25",
    horario: "09:00",
    antecedencia_cancelamento_esperada: 24
  }));
  expect(bookingPayload).not.toHaveProperty("cliente_nome");
  expect(bookingPayload).not.toHaveProperty("cliente_whatsapp");

  await expectNoHorizontalOverflow(page);
});
