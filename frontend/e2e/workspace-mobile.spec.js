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

  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth ===
    document.documentElement.clientWidth
  ))).toBe(true);
});
