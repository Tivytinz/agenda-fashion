const fs = require(
  "node:fs"
);
const path = require(
  "node:path"
);

function ler(arquivo) {
  return fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      arquivo
    ),
    "utf8"
  );
}

describe(
  "Critérios não funcionais operacionais P0",
  () => {
    test(
      "CA-NFR-07: existe decisão formal sem declarar RPO/RTO não comprovados",
      () => {
        const runbook =
          ler(
            "docs/backup-recovery.md"
          );

        expect(
          runbook
        ).toContain(
          "RPO ≤ 1 hora"
        );
        expect(
          runbook
        ).toContain(
          "RTO ≤ 4 horas"
        );
        expect(
          runbook
        ).toContain(
          "não considera CA-NFR-07 atendido por operação real"
        );
        expect(
          runbook
        ).toContain(
          "não fecha sozinha o"
        );
        expect(
          runbook
        ).toContain(
          "não equivale"
        );
        expect(
          runbook
        ).toContain(
          "restore test"
        );
      }
    );

    test(
      "CA-NFR-08: PR executa o Quality gate com as suítes críticas",
      () => {
        const workflow =
          ler(
            ".github/workflows/backend-ci.yml"
          );

        expect(
          workflow
        ).toMatch(
          /pull_request:/
        );
        expect(
          workflow
        ).toMatch(
          /name:\s*Quality gate/
        );
        expect(
          workflow
        ).toContain(
          "npm run migrate:test"
        );
        expect(
          workflow
        ).toContain(
          "npm run test:coverage"
        );
        expect(
          workflow
        ).toContain(
          "npm run frontend:test"
        );
        expect(
          workflow
        ).toContain(
          "npm --prefix frontend run test:e2e"
        );
        expect(
          workflow
        ).not.toMatch(
          /continue-on-error:\s*true/
        );
      }
    );
  }
);
