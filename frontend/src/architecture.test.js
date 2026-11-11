import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
const files = filesIn(root).filter(file => [".js", ".jsx"].includes(extname(file)) && !/\.(test|spec)\./.test(file));
const known = new Set(files);
const label = file => relative(root, file).replaceAll("\\", "/");
const graph = new Map();
const parseErrors = [];
const linter = new Linter();
for (const file of files) {
  const references = [];
  const record = node => { if (typeof node.source?.value === "string") references.push(node.source.value); };
  const messages = linter.verify(readFileSync(file, "utf8"), {
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { architecture: { rules: { imports: {
      create: () => ({ ImportDeclaration: record, ExportNamedDeclaration: record, ExportAllDeclaration: record, ImportExpression: record })
    } } } },
    rules: { "architecture/imports": "error" }
  });
  parseErrors.push(...messages.map(message => `${label(file)}: ${message.message}`));
  graph.set(file, references.filter(ref => ref.startsWith(".")).flatMap(ref => {
    const base = resolve(dirname(file), ref);
    const target = [base, `${base}.js`, `${base}.jsx`, join(base, "index.js"), join(base, "index.jsx")].find(candidate => known.has(candidate));
    return target ? [target] : [];
  }));
}

it("analisa todos os módulos de produção sem ignorar erros de sintaxe", () => {
  expect(parseErrors).toEqual([]);
});

it("mantém composição de páginas fora de primitives, sessão e lógica de feature", () => {
  const violations = [];
  for (const [file, dependencies] of graph) {
    for (const dependency of dependencies) {
      const from = label(file), to = label(dependency);
      if (/^(api|auth|analytics|components|features|hooks|utils)\//.test(from) && to.startsWith("pages/")) violations.push(`${from} → ${to}`);
      if (from.startsWith("utils/") && /^(components|hooks)\//.test(to)) violations.push(`${from} → ${to}`);
    }
  }
  expect(violations).toEqual([]);
});

it("mantém o grafo de imports JS/JSX sem ciclos", () => {
  const visited = new Set(), active = new Set(), stack = [], cycles = [];
  function visit(file) {
    if (active.has(file)) { cycles.push(stack.slice(stack.indexOf(file)).concat(file).map(label)); return; }
    if (visited.has(file)) return;
    active.add(file); stack.push(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    stack.pop(); active.delete(file); visited.add(file);
  }
  files.forEach(visit);
  expect(cycles).toEqual([]);
});

it("mantém tokens e primitives globais sob um único ownership", () => {
  const entry = readFileSync(join(root, "styles/index.css"), "utf8");
  expect(entry).toContain('@import "./tokens.css"');
  expect(entry).toContain('@import "./controls.css"');
  const conflicts = [];
  for (const file of filesIn(join(root, "styles")).filter(file => extname(file) === ".css")) {
    const css = readFileSync(file, "utf8"), name = label(file);
    if (name !== "styles/tokens.css" && /^:root\s*\{/m.test(css)) conflicts.push(name);
    if (name !== "styles/controls.css" && /^\.button(?=[\s:{._-]|$)/m.test(css)) conflicts.push(name);
  }
  expect(conflicts).toEqual([]);
});
