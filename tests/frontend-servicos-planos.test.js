const fs = require("fs");
const path = require("path");

function ler(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

describe("Sprint de catálogo, planos e navegação", () => {
  test("liga o editor React aos endpoints de foto e galeria", () => {
    const app = ler("frontend/src/App.jsx");
    const services = ler("frontend/src/pages/ServicesPage.jsx");

    expect(app).toContain('path="/painel/servicos/novo"');
    expect(app).toContain('path="/painel/servicos/:id/editar"');
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
});
