const fs = require("fs");
const path = require("path");

describe("rotas SPA servidas pelo Express", () => {
  const serverSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "server.js"),
    "utf8"
  );
  const routes = require("../src/config/reactRoutes.json");

  it("mantém o manifesto explícito de rotas React", () => {
    expect(serverSource).toContain("Object.values(");
    expect(serverSource).toContain("reactRoutes");
    expect(Object.keys(routes).length).toBeGreaterThan(20);
  });

  it.each([
    "/privacidade",
    "/admin/trafego-pago",
    "/admin/trafego-pago/custos",
    "/admin/trafego-pago/profissionais",
  ])("serve %s pelo fallback da SPA", (route) => {
    expect(Object.values(routes)).toContain(route);
  });
});
