const fs = require("fs");
const path = require("path");

const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/performance-qa.yml"), "utf8");
const pullRequestTrigger = workflow.split("  pull_request:")[1]?.split("  push:")[0] || "";

describe("cobertura de performance dos estilos públicos globais", () => {
  test.each(["index.css", "tokens.css", "controls.css", "af-experience.css"])(
    "alterar somente %s também aciona Performance QA no PR",
    (file) => {
      expect(pullRequestTrigger).toContain(`- "frontend/src/styles/${file}"`);
      expect(pullRequestTrigger).toContain("- main");
    }
  );
});
