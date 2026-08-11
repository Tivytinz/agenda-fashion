const fs = require("fs");
const path = require("path");

describe("rotas SPA servidas pelo Express", () => {
  const serverSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "server.js"),
    "utf8"
  );
  const routes = require("../src/config/reactRoutes.json");
  const cacheSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "utils", "httpCache.js"),
    "utf8"
  );

  it("mantém o manifesto explícito de rotas React", () => {
    expect(serverSource).toContain("Object.values(");
    expect(serverSource).toContain("reactRoutes");
    expect(Object.keys(routes).length).toBeGreaterThan(20);
  });

  it.each([
    "/para-profissionais",
    "/privacidade",
    "/admin/trafego-pago",
    "/admin/trafego-pago/custos",
    "/admin/trafego-pago/profissionais",
  ])("serve %s pelo fallback da SPA", (route) => {
    expect(Object.values(routes)).toContain(route);
  });

  it("não reutiliza HTML antigo e mantém assets versionados em cache", () => {
    expect(serverSource).toContain("disableDocumentCache");
    expect(serverSource).toContain('index: false');
    expect(cacheSource).toContain(
      '"no-store, no-cache, must-revalidate"'
    );
    expect(cacheSource).toContain(
      '"public, max-age=31536000, immutable"'
    );
  });
});
