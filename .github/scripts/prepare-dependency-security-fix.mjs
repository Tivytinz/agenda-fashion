#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoDir = process.cwd();
const lockPath = path.join(repoDir, 'package-lock.json');
const workflowPath = path.join(repoDir, '.github', 'workflows', 'backend-ci.yml');
const docPath = path.join(repoDir, 'docs', 'dependency-security.md');

function fail(message) { throw new Error(message); }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`); return fs.readFileSync(file, 'utf8'); }
function assertVersion(packages, key, allowed) {
  const entry = packages[key];
  if (!entry) fail(`Entrada ausente no lockfile: ${key}`);
  if (!allowed.includes(entry.version)) fail(`${key}: versão inesperada ${entry.version}; esperado ${allowed.join(' ou ')}`);
  return entry;
}
function replaceExact(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) fail(`Trecho esperado não encontrado em ${label}`);
  return text.replace(from, to);
}

const lockText = read(lockPath);
const workflowText = read(workflowPath);
const docText = read(docPath);
const lock = JSON.parse(lockText);
const packages = lock.packages;
if (!packages || typeof packages !== 'object') fail('package-lock.json sem campo packages');

{
  const current = assertVersion(packages, 'node_modules/body-parser', ['2.2.2', '2.3.0']);
  if (current.version === '2.2.2') {
    Object.assign(current, {
      version: '2.3.0',
      resolved: 'https://registry.npmjs.org/body-parser/-/body-parser-2.3.0.tgz',
      integrity: 'sha512-2cGmJupaNgg+QUwVLAucDuWuoMZ6EX9iHDRswZ5lsNYEmwPaRknMPCLZz07yTzVq/83p4o/wzbDZbBrTvGGTIw=='
    });
    current.dependencies = {
      bytes: '^3.1.2',
      'content-type': '^2.0.0',
      debug: '^4.4.3',
      'http-errors': '^2.0.1',
      'iconv-lite': '^0.7.2',
      'on-finished': '^2.4.1',
      qs: '^6.15.2',
      'raw-body': '^3.0.2',
      'type-is': '^2.1.0'
    };
  }
}

{
  const current = assertVersion(packages, 'node_modules/qs', ['6.15.2', '6.16.0']);
  if (current.version === '6.15.2') {
    Object.assign(current, {
      version: '6.16.0',
      resolved: 'https://registry.npmjs.org/qs/-/qs-6.16.0.tgz',
      integrity: 'sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA=='
    });
    current.dependencies = {
      'es-define-property': '^1.0.1',
      'side-channel': '^1.1.1'
    };
  }
}

{
  const current = assertVersion(packages, 'node_modules/side-channel', ['1.1.0', '1.1.1']);
  if (current.version === '1.1.0') {
    Object.assign(current, {
      version: '1.1.1',
      resolved: 'https://registry.npmjs.org/side-channel/-/side-channel-1.1.1.tgz',
      integrity: 'sha512-6x6dK6zJdpTzF4sQeNYxwtvBzf6Eg4GtlesS94HOvTudUeyK2WXAaIfmDgsyslYrRBeFIlsi54AYsFGUuhmvrQ=='
    });
    current.dependencies = {
      'es-errors': '^1.3.0',
      'object-inspect': '^1.13.4',
      'side-channel-list': '^1.0.1',
      'side-channel-map': '^1.0.1',
      'side-channel-weakmap': '^1.0.2'
    };
  }
}

for (const [key, entry] of Object.entries(packages)) {
  if (!(key === 'node_modules/brace-expansion' || key.endsWith('/node_modules/brace-expansion'))) continue;
  if (entry.version === '5.0.8') {
    Object.assign(entry, { version: '5.0.9', resolved: 'https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz', integrity: 'sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==' });
  } else if (entry.version === '2.1.2') {
    Object.assign(entry, { version: '2.1.4', resolved: 'https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz', integrity: 'sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==' });
  } else if (entry.version === '1.1.16') {
    Object.assign(entry, { version: '1.1.18', resolved: 'https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz', integrity: 'sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==' });
  }
}

{
  const current = assertVersion(packages, 'node_modules/fast-uri', ['3.1.4', '3.1.7']);
  if (current.version === '3.1.4') Object.assign(current, { version: '3.1.7', resolved: 'https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz', integrity: 'sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==' });
}

{
  const current = assertVersion(packages, 'node_modules/js-yaml', ['4.3.0', '4.3.1']);
  if (current.version === '4.3.0') Object.assign(current, { version: '4.3.1', resolved: 'https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz', integrity: 'sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==' });
}

{
  const key = 'node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml';
  const current = assertVersion(packages, key, ['3.15.0', '3.15.1']);
  if (current.version === '3.15.0') Object.assign(current, { version: '3.15.1', resolved: 'https://registry.npmjs.org/js-yaml/-/js-yaml-3.15.1.tgz', integrity: 'sha512-S99WuO3HlhO3XN41EtYUNl9zzXjoJx7QvmipxsJVxtCBT0YHEFy+iOJhjSvrmV12nYhWpZaM8lPHkJm0yUMbag==' });
}

const nestedContentTypeKey = 'node_modules/body-parser/node_modules/content-type';
if (!packages[nestedContentTypeKey]) {
  const reordered = {};
  for (const [key, value] of Object.entries(packages)) {
    reordered[key] = value;
    if (key === 'node_modules/body-parser') {
      reordered[nestedContentTypeKey] = {
        version: '2.0.0',
        resolved: 'https://registry.npmjs.org/content-type/-/content-type-2.0.0.tgz',
        integrity: 'sha512-j/O/d7GcZCyNl7/hwZAb606rzqkyvaDctLmckbxLzHvFBzTJHuGEdodATcP3yIRoDrLHkIATJuvzbFlp/ki2cQ==',
        license: 'MIT', engines: { node: '>=18' }, funding: { type: 'opencollective', url: 'https://opencollective.com/express' }
      };
    }
  }
  lock.packages = reordered;
}

const auditBlock = `      - name: Run tests with coverage\n        run: npm run test:coverage\n\n      - name: Audit production dependencies\n        run: npm audit --omit=dev --audit-level=high`;
const hardenedAuditBlock = `      - name: Run tests with coverage\n        run: npm run test:coverage\n\n      - name: Audit backend and tooling dependencies\n        run: npm audit --audit-level=high\n\n      - name: Audit production dependencies\n        run: npm audit --omit=dev --audit-level=high`;
const nextWorkflow = replaceExact(workflowText, auditBlock, hardenedAuditBlock, 'backend-ci.yml');

const docGateOld = `O workflow principal executa dois audits com severidade mínima \`high\`:\n\n- backend/runtime: \`npm audit --omit=dev --audit-level=high\`;\n- frontend, incluindo tooling de build e teste: \`npm --prefix frontend audit --audit-level=high\`.`;
const docGateNew = `O workflow principal executa três audits com severidade mínima \`high\`:\n\n- backend + tooling de teste: \`npm audit --audit-level=high\`;\n- backend/runtime: \`npm audit --omit=dev --audit-level=high\`;\n- frontend, incluindo tooling de build e teste: \`npm --prefix frontend audit --audit-level=high\`.\n\nO audit completo da raiz impede que vulnerabilidades \`high\` ou \`critical\` em Jest e outras ferramentas do backend passem pelo CI. O audit com \`--omit=dev\` continua separado para manter um sinal explícito sobre o grafo efetivamente usado em produção.`;
let nextDoc = replaceExact(docText, docGateOld, docGateNew, 'dependency-security.md');
const remediationHeading = '## Remediação adicional de setembro de 2026';
if (!nextDoc.includes(remediationHeading)) {
  nextDoc = nextDoc.trimEnd() + `\n\n${remediationHeading}\n\nUma revisão do grafo raiz identificou advisories transitivos que não apareciam no gate de runtime porque estavam concentrados em tooling, além de findings de menor severidade no grafo do Express. A remediação preservou as majors e os ranges já aceitos pelos pacotes pais: \`body-parser@2.3.0\`, \`qs@6.16.0\`, \`side-channel@1.1.1\`, \`brace-expansion@5.0.9/2.1.4/1.1.18\`, \`fast-uri@3.1.7\` e \`js-yaml@4.3.1/3.15.1\`. Não foram adicionados ignores nem upgrades forçados de major.\n\nO CI também passou a auditar o grafo completo da raiz com severidade mínima \`high\`, mantendo em paralelo o audit exclusivo de runtime e o audit do frontend.\n`;
}

fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
fs.writeFileSync(workflowPath, nextWorkflow);
fs.writeFileSync(docPath, nextDoc);
