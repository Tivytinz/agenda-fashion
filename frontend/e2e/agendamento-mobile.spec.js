import { expect, test } from "@playwright/test";

const PROFILE = {
  negocio: {
    id: 7,
    nome: "Studio Aurora",
    descricao: "Beleza com hora marcada",
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
      foto_url: "/media/manicure.jpg",
      valor: 50
    },
    {
      id: 12,
      nome: "Pedicure spa",
      duracao_minutos: 50,
      foto_url: "/media/pedicure.jpg",
      valor: 65
    },
    {
      id: 13,
      nome: "Alongamento em gel",
      duracao_minutos: 120,
      foto_url: "/media/gel.jpg",
      valor: 120
    }
  ],
  profissionais: [{ id: 21, nome: "Ana", servico_ids: [11, 12, 13] }]
};

const AVAILABILITY = Array.from({ length: 7 }, (_, dayIndex) => ({
  data: `2026-08-${String(dayIndex + 5).padStart(2, "0")}`,
  horarios: Array.from({ length: 12 }, (_, hourIndex) => (
    `${String(8 + Math.floor(hourIndex / 2)).padStart(2, "0")}:${hourIndex % 2 ? "30" : "00"}`
  ))
}));

async function expectKeyboardFocusVisible(
  page,
  locator
) {
  for (
    let tentativa = 0;
    tentativa < 30;
    tentativa += 1
  ) {
    await page.keyboard.press("Tab");

    if (
      await locator.evaluate(
        (elemento) =>
          elemento ===
          document.activeElement
      )
    ) {
      const indicador =
        await locator.evaluate(
          (elemento) => {
            const estilo =
              getComputedStyle(
                elemento
              );

            return (
              estilo.outlineStyle !==
                "none" &&
              parseFloat(
                estilo.outlineWidth
              ) > 0
            ) ||
              estilo.boxShadow !==
                "none";
          }
        );

      expect(indicador).toBe(true);
      return;
    }
  }

  throw new Error(
    "Controle não recebeu foco por teclado."
  );
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

test("perfil e agendamento permanecem contidos no celular", async ({ page }) => {
  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));
  await page.route("**/media/*.jpg**", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='220'><rect width='100%' height='100%' fill='#f7b5cf'/></svg>"
    });
  });
  await page.route("**/perfil-negocio/studio-aurora", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(PROFILE)
  }));
  await page.route("**/agenda-publica**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      disponibilidade: AVAILABILITY
    })
  }));
  await page.route("**/agenda-publica/politica-cancelamento?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      politica_cancelamento: {
        antecedencia_horas: 24
      }
    })
  }));
  await page.route("**/agendamentos", (route) => route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({
      agendamento: {
        id: 90,
        data: "2026-08-05",
        horario: "09:00",
        status: "agendado"
      }
    })
  }));

  await page.goto("/negocio/studio-aurora");
  await expect(page.getByRole("heading", { name: "Studio Aurora" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page.getByRole("img", {
    name: "Foto do serviço Manicure completa"
  })).toBeVisible();

  const serviceButton =
    page.getByRole("button", {
      name: "Selecionar Manicure completa",
      exact: true
    });
  await expect(
    serviceButton
  ).toBeVisible();
  await expectKeyboardFocusVisible(
    page,
    serviceButton
  );
  await serviceButton.press(
    "Enter"
  );
  await expect(page.getByText("Manicure completa", {
    exact: true
  }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page.locator(".date-button")).toHaveCount(7);
  await expect(page.locator(".date-button").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "13:30" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "09:00" }).click();

  const confirmationButton = page.getByRole("button", {
    name: "Revisar e confirmar"
  });
  await expect(confirmationButton).toBeVisible();
  await expect.poll(async () => {
    const box = await confirmationButton.boundingBox();
    return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY;
  }).toBeLessThanOrEqual(page.viewportSize().height - 8);
  await expectNoHorizontalOverflow(page);

  await confirmationButton.click();

  await expect(page).toHaveURL(/\/confirmar$/);
  await expect(page.getByRole("heading", {
    name: "Confirme seus dados"
  })).toBeVisible();
  await expect(page.getByText(
    "Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência."
  )).toBeVisible();

  await page.getByRole("textbox", {
    name: "Seu nome"
  }).fill("Cliente Mobile");
  await page.getByRole("textbox", {
    name: "WhatsApp para confirmação"
  }).fill("62999998888");

  const confirmBookingButton = page.getByRole("button", {
    name: "Confirmar agendamento"
  });
  await expect(confirmBookingButton).toBeEnabled();
  await confirmBookingButton.click();

  await expect(page).toHaveURL(/\/sucesso$/);
  await expect(page.getByRole("heading", {
    name: "Agendamento confirmado"
  })).toBeVisible();
  await expect(page.getByText(
    /Manicure completa com Ana/
  )).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
