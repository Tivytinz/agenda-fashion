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
  profissionais: [{ id: 21, nome: "Ana" }]
};

const AVAILABILITY = Array.from({ length: 7 }, (_, dayIndex) => ({
  data: `2026-08-${String(dayIndex + 5).padStart(2, "0")}`,
  horarios: Array.from({ length: 12 }, (_, hourIndex) => (
    `${String(8 + Math.floor(hourIndex / 2)).padStart(2, "0")}:${hourIndex % 2 ? "30" : "00"}`
  ))
}));

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
  let manicureRequests = 0;

  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));
  await page.route("**/media/*.jpg**", (route) => {
    if (route.request().url().includes("manicure.jpg")) {
      manicureRequests += 1;
      if (manicureRequests === 1) {
        return route.fulfill({ status: 503, body: "temporariamente indisponível" });
      }
    }

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
  await expect.poll(() => manicureRequests).toBe(2);

  await page.getByRole("button", { name: /Manicure completa/ }).click();
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
});
