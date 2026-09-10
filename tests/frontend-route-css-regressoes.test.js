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
      "plans-polish.css",
      "admin-saas-health.css",
      "admin-whatsapp.css"
    ];

    estilos.forEach((estilo) => {
      expect(entrada).not.toContain(`import "./styles/${estilo}"`);
      expect(app).toContain(`import("./styles/${estilo}")`);
    });

    expect(entrada).not.toContain('import "./styles/admin-shell.css"');
    expect(app).toContain('import("./styles/admin-shell.css")');
    expect(app).toMatch(
      /const AdminLayout = lazyNamedWithStyles\(\s*loadAdminShellStyles,/
    );

    [
      ["DashboardPage", "loadDashboardStyles"],
      ["AgendaWorkspacePage", "loadAgendaStyles"],
      ["ScheduleSettingsPage", "loadScheduleStyles"],
      ["BusinessPage", "loadBusinessStyles"],
      ["SubscriptionPage", "loadSubscriptionStyles"],
      ["PlansPage", "loadPlansStyles"],
      ["ServiceEditorPage", "loadServicesStyles"],
      ["ServicesPage", "loadServicesStyles"],
      ["AdminSaasHealthPage", "loadAdminSaasHealthStyles"],
      ["AdminWhatsAppPage", "loadAdminWhatsAppStyles"]
    ].forEach(([pagina, loader]) => {
      expect(app).toMatch(
        new RegExp(`const ${pagina} = lazyNamedWithStyles\\(\\s*${loader},`)
      );
    });
  });

  test("carrega o design system da dona somente quando o OwnerShell e resolvido", () => {
    const entrada = ler("frontend/src/main.jsx");
    const workspace = ler("frontend/src/components/WorkspaceLayout.jsx");
    const ownerShell = ler("frontend/src/components/OwnerShell.jsx");

    expect(entrada).not.toContain('owner-shell.css');
    expect(ownerShell).not.toContain('owner-shell.css');
    expect(workspace).toContain('import("../styles/owner-shell.css")');
    expect(workspace).toContain('import("./OwnerShell")');
  });

  test("mantem globais os estilos ainda compartilhados entre contextos", () => {
    const entrada = ler("frontend/src/main.jsx");

    [
      "home-discovery.css",
      "profile-polish.css",
      "account-polish.css"
    ].forEach((estilo) => {
      expect(entrada).toContain(`import "./styles/${estilo}"`);
    });
  });

  test("mantem o shell administrativo sem ownership de Saude ou WhatsApp", () => {
    const shell = ler("frontend/src/styles/admin-shell.css");

    expect(shell).not.toContain("saas-health-");
    expect(shell).not.toContain("whatsapp-");
  });

  test("nao carrega refinamentos administrativos pelo workspace profissional", () => {
    const workspace = ler("frontend/src/components/WorkspaceLayout.jsx");
    const overview = ler("frontend/src/pages/AdminOverviewPage.jsx");

    expect(workspace).not.toContain('import "../styles/admin-refinements.css"');
    expect(overview).toContain('import "../styles/admin-refinements.css"');
  });
});
