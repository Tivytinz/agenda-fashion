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

  await page.goto(
    "/para-profissionais?utm_source=google&utm_campaign=profissionais&gclid=e2e-123"
  );

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Receba agendamentos sem precisar responder cada cliente."
  })).toBeVisible();
  await expect(page.getByText("Plano grátis para começar", { exact: true }))
    .toBeVisible();
  await expect(page.getByText(
    "Aviso de novo agendamento pelo WhatsApp"
  )).toBeVisible();
  await expect(page.getByText(
    "Olá! Um novo agendamento foi realizado."
  )).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "Veja uma cliente agendando na Beauty Vanessa — do perfil ao aviso no WhatsApp."
  })).toBeVisible();
  await expect(page.getByRole("img", {
    name: "Foto do perfil Beauty Vanessa"
  })).toBeVisible();

  const beautyVanessaProfile = page.getByRole("link", {
    name: "Testar o agendamento real ↗"
  });
  await expect(beautyVanessaProfile).toBeVisible();
  await expect(beautyVanessaProfile)
    .toHaveAttribute("href", "/negocio/beauty-vanessa");
  await expect(page.getByText(
    "A agenda mostra somente datas e horários realmente disponíveis para a Vanessa."
  )).toBeVisible();

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
