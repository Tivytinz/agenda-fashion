const fs = require("fs");
const path = require("path");

function ler(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

describe("Sprint de catálogo, planos e navegação", () => {
  test("liga o editor React aos endpoints de foto e galeria", () => {
    const app = ler("frontend/src/App.jsx");
    const routes = JSON.parse(
      ler("src/config/reactRoutes.json")
    );
    const services = ler("frontend/src/pages/ServicesPage.jsx");

    expect(app).toContain("path={reactRoutes.newService}");
    expect(app).toContain("path={reactRoutes.editService}");
    expect(routes.newService).toBe("/painel/servicos/novo");
    expect(routes.editService).toBe("/painel/servicos/:id/editar");
    expect(services).toContain('`/servicos/${savedId}/foto`');
    expect(services).toContain('`/servicos/${savedId}/fotos`');
    expect(services).toContain('`/servicos/fotos/${photo.id}`');
    expect(services).toContain("descricao: form.descricao.trim()");
    expect(services).toContain("ativo: form.ativo");
  });

  test("corrige os planos na origem e usa pluralização natural", () => {
    const migration = ler("database/migrations/025_corrigir_nomes_planos.sql");
    const plans = ler("frontend/src/utils/plans.js");
    const styles = ler("frontend/src/styles/index.css");

    expect(migration).toContain("WHEN 'inicial' THEN 'Grátis'");
    expect(migration).toContain("WHEN 'autonoma' THEN 'Autônoma'");
    expect(migration).toContain("WHEN 'salao' THEN 'Salão'");
    expect(plans).not.toContain("profissional(is)");
    expect(plans).not.toContain("serviço(s)");
    expect(styles).toContain("grid-template-columns: repeat(4");
  });

  test("mantém retornos contextuais nas telas prioritárias", () => {
    const services = ler("frontend/src/pages/ServicesPage.jsx");
    const billing = ler("frontend/src/pages/BillingPages.jsx");
    const account = ler("frontend/src/pages/AccountPage.jsx");
    const business = ler("frontend/src/pages/BusinessPage.jsx");

    expect(services).toContain("Voltar à visão geral");
    expect(services).toContain("Voltar aos serviços");
    expect(billing).toContain("Voltar ao plano e assinatura");
    expect(account).toContain("Voltar à área de trabalho");
    expect(business).toContain("Voltar a explorar");
  });

  test("mantém os emojis de fallback centralizados nas mídias", () => {
    const styles = ler("frontend/src/styles/index.css");

    expect(styles).toContain(
      ".choice-card > span:not(.avatar):not(.af-media-thumb)"
    );
    expect(styles).toMatch(
      /\.af-media-fallback\s*\{[\s\S]*?place-items:\s*center;[\s\S]*?line-height:\s*1;/
    );
  });

  test("exibe a foto completa nos cards de negócios", () => {
    const styles = ler("frontend/src/styles/index.css");

    expect(styles).toContain(
      ".business-card .card-image img { object-fit: contain; }"
    );
    expect(styles).toMatch(
      /\.business-cover-backdrop\s*\{[^}]*object-fit:\s*cover;[^}]*filter:\s*blur\(18px\);/
    );
    expect(styles).toMatch(
      /\.business-cover-image\s*\{[^}]*object-fit:\s*contain;/
    );
    expect(styles).toMatch(
      /\.card-image img\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/
    );
  });

  test("exibe a foto completa nos cards de serviços", () => {
    const styles = ler("frontend/src/styles/index.css");
    const responsive = ler("frontend/src/styles/responsive.css");

    expect(styles).toMatch(
      /\.service-discovery-image img\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*object-fit:\s*contain;/
    );
    expect(responsive).toMatch(
      /\.service-discovery-image img\s*\{[\s\S]*?object-fit:\s*contain;/
    );
  });

  test("usa a logotipo oficial como ícone da aba", () => {
    const html = ler("frontend/index.html");

    expect(html).toContain('rel="icon"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain(
      '/src/assets/brand/af-logo-transparent.png'
    );
  });
});
