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
  servicos: [{
    id: 11,
    nome: "Manicure completa",
    descricao: "Cuidado completo para as unhas",
    duracao_minutos: 60,
    valor: 50
  }],
  profissionais: [{ id: 21, nome: "Ana" }]
};

test("cliente conclui um agendamento no celular sem estouro horizontal", async ({ page }) => {
  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 204,
    body: ""
  }));
  await page.route("**/perfil-negocio/studio-aurora", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(PROFILE)
  }));
  await page.route("**/agenda-publica**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      disponibilidade: [{
        data: "2026-08-05",
        horarios: ["09:00", "10:30"]
      }]
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
  await page.getByRole("button", { name: /Manicure completa/ }).click();
  await page.getByRole("button", { name: "09:00" }).click();
  await page.getByRole("button", { name: "Revisar e confirmar" }).click();

  await page.getByRole("textbox", { name: "Seu nome" }).fill("Victor Souza");
  await page.getByRole("textbox", { name: "Seu WhatsApp" }).fill("62999998888");
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();

  await expect(page.getByRole("heading", {
    name: "Agendamento confirmado"
  })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ));
  expect(hasHorizontalOverflow).toBe(false);
});
