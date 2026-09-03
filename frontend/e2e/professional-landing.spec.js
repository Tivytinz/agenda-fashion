import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toEqual(expect.objectContaining({
    clientWidth: page.viewportSize().width,
    scrollWidth: page.viewportSize().width
  }));
}

test("landing profissional comunica valor e preserva a atribuição", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("af_marketing_consent_v2", JSON.stringify({
      version: 2,
      status: "denied",
      updatedAt: "2026-08-19T00:00:00.000Z"
    }));
  });

  await page.route("**/eventos-produto", (route) => route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({ ok: true })
  }));

  await page.goto(
    "/para-profissionais?utm_source=google&utm_campaign=profissionais&gclid=e2e-123"
  );

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Sua cliente agenda. Você atende. O AF organiza e avisa."
  })).toBeVisible();
  await expect(page.getByText("Plano grátis para começar", { exact: true }))
    .toBeVisible();
  await expect(page.getByText(
    "Aviso pelo WhatsApp com sua autorização"
  )).toBeVisible();
  await expect(page.getByText(
    "Olá! Um novo agendamento foi realizado. ✨"
  )).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "Veja o Design + Henna da Beauty Vanessa sendo agendado até o aviso autorizado no WhatsApp."
  })).toBeVisible();
  await expect(page.getByText("Você divulga seu perfil", { exact: true }))
    .toBeVisible();
  await expect(page.getByText("A cliente escolhe o serviço", { exact: true }))
    .toBeVisible();
  await expect(page.getByText("Seleciona um horário livre", { exact: true }))
    .toBeVisible();
  await expect(page.getByText("Confirma o agendamento", { exact: true }))
    .toBeVisible();
  await expect(page.locator(".professional-demo-screenshot-grid"))
    .toHaveCount(0);

  const beautyVanessaProfile = page.getByRole("link", {
    name: "Testar no perfil real ↗"
  });
  await expect(beautyVanessaProfile).toBeVisible();
  await expect(beautyVanessaProfile)
    .toHaveAttribute("href", "/negocio/beauty-vanessa");
  await expect(page.getByText(
    "Com os avisos autorizados, o AF envia o novo agendamento para a Vanessa"
  )).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "Para profissionais autônomas, studios e salões de beleza"
  })).toBeVisible();
  await expect(page.getByText(
    "Seja nail, lash, sobrancelhas, estética, cabelo ou maquiagem: você configura seus próprios serviços, valores e horários."
  )).toBeVisible();
  await expect(page.getByText("Comece em poucos passos"))
    .toHaveCount(0);
  await expect(page.getByText("Depois do agendamento"))
    .toHaveCount(0);

  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Entrar" })).toBeVisible();
  await expect(header.getByRole("link", {
    name: "Início",
    exact: true
  })).toHaveCount(0);

  const signup = page.getByRole("link", {
    name: "Criar minha agenda grátis"
  }).first();
  const href = await signup.getAttribute("href");
  const url = new URL(href, page.url());

  expect(url.pathname).toBe("/cadastro");
  expect(url.searchParams.get("tipo")).toBe("profissional");
  expect(url.searchParams.get("utm_source")).toBe("google");
  expect(url.searchParams.get("utm_campaign")).toBe("profissionais");
  expect(url.searchParams.get("gclid")).toBe("e2e-123");
  await expectNoHorizontalOverflow(page);
});
