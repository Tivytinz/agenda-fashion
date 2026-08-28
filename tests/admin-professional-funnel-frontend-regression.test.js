const fs = require("fs");
const path = require("path");

const pagina = fs.readFileSync(
  path.join(
    __dirname,
    "../frontend/src/pages/AdminProfessionalFunnelPage.jsx"
  ),
  "utf8"
);

describe(
  "painel administrativo do funil profissional",
  () => {
    test(
      "separa funil operacional de métricas financeiras atribuídas",
      () => {
        expect(pagina).toContain(
          "const operationalSummary = data?.resumo"
        );
        expect(pagina).toContain(
          "const financialSummary = data?.resumoOficial"
        );
        expect(pagina).toContain(
          "Investimento por cadastro total"
        );
        expect(pagina).toContain(
          "diagnóstico bruto, não CPA atribuído"
        );
        expect(pagina).toContain(
          "todos os profissionais cadastrados no período selecionado"
        );
        expect(pagina).toContain(
          "somente na coorte com atribuição oficial"
        );
        expect(pagina).toContain(
          "CAC, ROAS e decisões de orçamento permanecem bloqueados"
        );
      }
    );
  }
);
