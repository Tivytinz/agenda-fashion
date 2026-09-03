const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");

function ler(caminho) {
  return fs.readFileSync(path.join(raiz, caminho), "utf8");
}

describe("ownership de CSS por rota", () => {
  test("remove refinamentos de feature da entrada global e carrega junto das paginas lazy", () => {
    const entrada = ler("frontend/src/main.jsx");
    const app = ler("frontend/src/App.jsx");

    const estilos = [
      "dashboard-polish.css",
      "agenda-polish.css",
      "schedule-polish.css",
      "service-media-polish.css",
      "service-catalog-polish.css",
      "business-polish.css",
      "subscription-polish.css",
      "plans-polish.css"
    ];

    estilos.forEach((estilo) => {
      expect(entrada).not.toContain(`import "./styles/${estilo}"`);
      expect(app).toContain(`import("./styles/${estilo}")`);
    });

    [
      ["DashboardPage", "loadDashboardStyles"],
      ["AgendaWorkspacePage", "loadAgendaStyles"],
      ["ScheduleSettingsPage", "loadScheduleStyles"],
      ["BusinessPage", "loadBusinessStyles"],
      ["SubscriptionPage", "loadSubscriptionStyles"],
      ["PlansPage", "loadPlansStyles"],
      ["ServiceEditorPage", "loadServicesStyles"],
      ["ServicesPage", "loadServicesStyles"]
    ].forEach(([pagina, loader]) => {
      expect(app).toMatch(
        new RegExp(`const ${pagina} = lazyNamedWithStyles\\(\\s*${loader},`)
      );
    });
  });

  test("mantem globais os estilos ainda compartilhados entre contextos", () => {
    const entrada = ler("frontend/src/main.jsx");

    [
      "home-discovery.css",
      "profile-polish.css",
      "account-polish.css",
      "admin-saas-health.css",
      "admin-whatsapp.css"
    ].forEach((estilo) => {
      expect(entrada).toContain(`import "./styles/${estilo}"`);
    });
  });
});