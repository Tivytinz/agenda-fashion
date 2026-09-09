const fs = require("fs");
const path = require("path");

const paginas = fs.readFileSync(
  path.join(
    __dirname,
    "../frontend/src/pages/AdminAnalyticsV2Pages.jsx"
  ),
  "utf8"
);
const app = fs.readFileSync(
  path.join(__dirname, "../frontend/src/App.jsx"),
  "utf8"
);

describe(
  "painel administrativo de aquisição 2.0",
  () => {
    test(
      "mantém métricas de aquisição e a compatibilidade da rota legada",
      () => {
        expect(paginas).toContain("AdminAcquisitionV2Page");
        expect(paginas).toContain("CAC");
        expect(paginas).toContain("ROAS");
        expect(paginas).toContain("qualidadeMensuracao");
        expect(app).toContain("path={reactRoutes.adminProfessionals}");
        expect(app).toContain("element={<AdminAcquisitionPage />}");
      }
    );
  }
);
