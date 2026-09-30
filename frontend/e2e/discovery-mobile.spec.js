import { expect, test } from "@playwright/test";

const catalog = {
  negocios: [{
    id: 1,
    nome: "Studio Aurora",
    slug: "studio-aurora",
    cidade: "Anápolis",
    estado: "GO",
    areas: ["unha"],
    servicos: [
      { id: 11, nome: "Manicure tradicional", categoria: "unha", valor: 45, duracao_minutos: 50 },
      {
        id: 12, nome: "Manicure em gel", categoria: "unha", valor: 80, duracao_minutos: 60,
        foto_url: "/assets/home/salon-hero-mobile.webp"
      }
    ]
  }],
  localidades: [{ cidade: "Anápolis", estado: "GO", total_negocios: 1 }],
  paginacao: { total: 1, tem_mais: false }
};

test.beforeEach(async ({ page }) => {
  await page.route("**/negocios-publicos**", (route) => route.fulfill({ json: catalog }));
  await page.route("**/marketing/**", (route) => route.fulfill({ json: { enabled: false } }));
  await page.route("**/eventos-produto", (route) => route.fulfill({ status: 204, body: "" }));
});

test("todos os destaques acomodam texto e CTA sem corte ou overflow mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const dots = page.getByRole("button", { name: /Mostrar destaque/ });
  await expect(dots).toHaveCount(7);

  for (let index = 0; index < 7; index += 1) {
    await dots.nth(index).click();
    const slide = page.locator('.home-hero-slide[aria-hidden="false"]');
    const frame = await page.locator(".home-hero-frame").boundingBox();
    const controls = await page.locator(".home-hero-dots").boundingBox();
    for (const selector of ["h1", ".home-hero-subtitle", ".home-hero-description", ".home-hero-primary"]) {
      const box = await slide.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(frame.x);
      expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.y).toBeGreaterThanOrEqual(frame.y);
      expect(box.y + box.height).toBeLessThanOrEqual(controls.y);
    }
  }

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
});

test("nova busca preserva os filtros, exibe serviços por UF e permite limpar", async ({ page }) => {
  await page.goto("/?categoria=unha&cidade=An%C3%A1polis&estado=GO");
  await page.getByRole("searchbox").fill("manicure GO");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByRole("heading", { name: "Manicure tradicional" })).toBeVisible();
  const params = new URL(page.url()).searchParams;
  expect(params.get("categoria")).toBe("unha");
  expect(params.get("cidade")).toBe("Anápolis");
  expect(params.get("estado")).toBe("GO");
  await expect(page.getByRole("combobox", { name: "Escolher localização" })).toHaveValue("Anápolis::GO");
  const location = page.getByRole("combobox", { name: "Escolher localização" });
  await page.keyboard.press("Tab");
  await location.focus();
  expect(await location.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("combobox", { name: "Escolher localização" })).toHaveValue("");
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("cards sem foto são compactos e os CTAs têm contraste de texto normal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Manicure tradicional" })).toBeVisible();
  const placeholder = await page.locator(".service-discovery-image-placeholder").boundingBox();
  const photo = await page.locator(".service-discovery-image:not(.service-discovery-image-placeholder)").boundingBox();
  expect(placeholder.height).toBeLessThan(photo.height);

  const contrasts = await page.locator(
    '.home-hero-slide[aria-hidden="false"] .home-hero-primary, .home-page .business-card .button, .home-page .service-discovery-content .button'
  ).evaluateAll((buttons) => {
    function luminance(color) {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    return buttons.map((button) => {
      const style = getComputedStyle(button);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  });
  expect(contrasts.length).toBeGreaterThanOrEqual(4);
  contrasts.forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5));
});
