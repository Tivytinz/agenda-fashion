const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const workflow = read(".github/workflows/backend-ci.yml");
const e2e = workflow.split("  e2e:\n")[1].split("  quality-gate:\n")[0];
const lock = JSON.parse(read("frontend/package-lock.json"));

test("imagem dos navegadores acompanha a versão instalada do Playwright", () => {
  const version = lock.packages["node_modules/@playwright/test"].version;
  expect(e2e).toContain(`image: mcr.microsoft.com/playwright:v${version}-noble`);
  expect(e2e).not.toContain("playwright install");
  expect(e2e).toContain("runs-on: ubuntu-24.04");
});

test("container E2E usa o PostgreSQL do serviço e preserva os quatro shards", () => {
  const database = e2e.match(/DATABASE_URL:\s*(\S+)/)[1];
  expect(new URL(database).hostname).toBe("postgres");
  expect(e2e).toContain("shard: [1, 2, 3, 4]");
  expect(e2e).toContain("npm --prefix frontend run test:e2e -- --shard=${{ matrix.shard }}/4");
  expect(e2e).toContain("if: matrix.shard == 1");
  expect(e2e).toContain("npm --prefix frontend run test:e2e:fullstack");
});

test("preflight verifica ambos os navegadores sem dispensar o Quality gate", () => {
  expect(e2e).toContain("for (const browserType of [chromium, webkit])");
  expect(e2e).toContain("browserType.launch({ headless: true, timeout: 15000 })");
  expect(e2e).toContain("timeout-minutes: 2");
  expect(workflow).toContain('test "$E2E_RESULT" = "success"');
});
