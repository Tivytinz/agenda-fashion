const fs = require("fs");
const path = require("path");

describe("rotas SPA servidas pelo Express", () => {
  const serverSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "server.js"),
    "utf8"
  );

  const match = serverSource.match(/const rotasReact = \[([\s\S]*?)\];/);

  it("mantém o manifesto explícito de rotas React", () => {
    expect(match).not.toBeNull();
  });

  it.each([
    "/privacidade",
    "/admin/trafego-pago",
    "/admin/trafego-pago/custos",
    "/admin/trafego-pago/profissionais",
  ])("serve %s pelo fallback da SPA", (route) => {
    expect(match?.[1]).toContain(`\"${route}\"`);
  });
});
