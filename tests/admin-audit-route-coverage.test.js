const adminRoutes = require("../src/routes/adminRoutes");

test("cada rota administrativa mutável tem auditoria antes do controller", () => {
  const exceptions = new Set([
    // POST only tests external access; it does not change AF or provider state.
    "/admin/marketing/custos-integracoes/:provedor/testar"
  ]);
  const mutations = adminRoutes.stack
    .filter((layer) => layer.route)
    .filter((layer) => ["post", "patch", "put", "delete"]
      .some((method) => layer.route.methods[method]));

  expect(mutations.length).toBeGreaterThan(10);
  for (const layer of mutations) {
    if (exceptions.has(layer.route.path)) continue;
    const names = layer.route.stack.map((handler) => handler.handle.name);
    expect(names).toContain("auditRequest");
    expect(names.indexOf("authAdmin")).toBeLessThan(names.indexOf("auditRequest"));
    expect(names.indexOf("auditRequest")).toBeLessThan(names.length - 1);
  }
});
