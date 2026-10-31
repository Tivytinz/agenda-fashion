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
  expect(await location.evaluate((element) =>
    getComputedStyle(element.closest("label")).outlineStyle
  )).toBe("solid");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("combobox", { name: "Escolher localização" })).toHaveValue("");
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("cards sem foto são compactos, fotos preservam proporção e CTAs têm contraste", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Manicure tradicional" })).toBeVisible();
  const placeholder = await page.locator(".service-discovery-image-placeholder").boundingBox();
  const photo = await page.locator(".service-discovery-image:not(.service-discovery-image-placeholder)").boundingBox();
  expect(placeholder.height).toBeGreaterThan(0);
  expect(photo.height).toBeGreaterThan(0);
  expect(placeholder.height).toBeLessThan(photo.height);
  expect(photo.width / photo.height).toBeCloseTo(16 / 9, 1);
  expect(placeholder.height).toBeGreaterThanOrEqual(44);

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

test("busca e cidade exibem apenas o contorno externo ao receber foco", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("searchbox", { name: "Qual serviço?" });
  const city = page.getByRole("combobox", { name: "Escolher localização" });
  await expect(city).toBeEnabled();

  for (const control of [input, city]) {
    await control.focus();
    const focus = await control.evaluate((element) => {
      const inner = getComputedStyle(element);
      const outer = getComputedStyle(element.closest("label"));
      return {
        innerOutline: inner.outlineWidth,
        innerShadow: inner.boxShadow,
        outerOutline: outer.outlineWidth,
        outerStyle: outer.outlineStyle
      };
    });
    expect(focus.innerOutline).toBe("0px");
    expect(focus.innerShadow).toBe("none");
    expect(focus.outerOutline).toBe("3px");
    expect(focus.outerStyle).toBe("solid");
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeFocused();
});

test("cards da mesma fileira têm alturas iguais e botões alinhados com conteúdo variado", async ({ page }) => {
  const names = ["Studio curto", "Studio com nome longo para cuidados de beleza e estética", "Studio sem descrição"];
  await page.route("**/negocios-publicos**", (route) => route.fulfill({ json: {
    ...catalog,
    negocios: names.map((nome, index) => ({
      ...catalog.negocios[0],
      id: index + 1,
      slug: `studio-${index}`,
      nome,
      descricao: index === 0 ? "Atendimento acolhedor." : index === 1 ? "Cuidados de beleza com atendimento personalizado. Conheça os serviços e escolha seu próximo cuidado." : "",
      foto_url: index === 1 ? "/assets/home/salon-hero-mobile.webp" : null,
      servicos: catalog.negocios[0].servicos.map((service) => ({
        ...service,
        id: service.id + index * 100,
        foto_url: index === 2 ? null : service.foto_url,
        nome: index === 1 ? `${service.nome} com acabamento especial e atendimento personalizado` : service.nome
      }))
    }))
  } }));
  await page.goto("/");
  await expect(page.locator(".home-business-rail .business-card")).toHaveCount(3);
  await expect(page.locator(".home-services-grid .service-discovery-card")).toHaveCount(6);

  async function assertAligned() {
    const businesses = await page.locator(".home-business-rail .business-card").evaluateAll((cards) => cards.map((card) => ({
      height: card.getBoundingClientRect().height,
      actionBottom: card.querySelector(".button").getBoundingClientRect().bottom,
      mediaHeight: card.querySelector(".card-image").getBoundingClientRect().height
    })));
    for (const card of businesses) {
      expect(Math.abs(card.height - businesses[0].height)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.actionBottom - businesses[0].actionBottom)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.mediaHeight - businesses[0].mediaHeight)).toBeLessThanOrEqual(1);
    }
    const services = await page.locator(".home-services-grid .service-discovery-card").evaluateAll((cards) => cards.map((card) => ({
      top: Math.round(card.getBoundingClientRect().top),
      height: card.getBoundingClientRect().height,
      actionBottom: card.querySelector(".button").getBoundingClientRect().bottom
    })));
    for (const card of services) {
      const first = services.find((other) => other.top === card.top);
      expect(Math.abs(card.height - first.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.actionBottom - first.actionBottom)).toBeLessThanOrEqual(1);
    }
  }

  await assertAligned();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAligned();
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await assertAligned();
  await expect(page.getByRole("heading", { name: names[1], exact: true })).toHaveText(names[1]);
});

test("setas têm botões circulares, ícones proporcionais e avançam a fileira", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  const next = page.getByRole("button", { name: "Avançar em categorias" });
  await expect(next).toBeVisible();
  for (const arrow of [page.getByRole("button", { name: "Próximo destaque" }), next]) {
    const button = await arrow.boundingBox();
    const icon = await arrow.locator("svg").boundingBox();
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeCloseTo(button.height, 0);
    expect(icon.width).toBeLessThan(button.width / 2);
    expect(Math.abs(icon.x + icon.width / 2 - button.x - button.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(icon.y + icon.height / 2 - button.y - button.height / 2)).toBeLessThanOrEqual(1);
  }
  const track = page.locator(".home-category-rail");
  await next.click();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Voltar em categorias" })).toBeVisible();
});
