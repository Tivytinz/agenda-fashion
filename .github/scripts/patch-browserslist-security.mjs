#!/usr/bin/env node

import fs from 'node:fs';

const lockPath = 'package-lock.json';
const docPath = 'docs/dependency-security.md';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const p = lock.packages;

function patch(key, from, to, resolved, integrity, dependencies) {
  const entry = p[key];
  if (!entry) throw new Error(`Entrada ausente: ${key}`);
  if (entry.version !== from && entry.version !== to) throw new Error(`${key}: versão inesperada ${entry.version}`);
  if (entry.version === from) {
    entry.version = to;
    entry.resolved = resolved;
    entry.integrity = integrity;
    if (dependencies) entry.dependencies = dependencies;
  }
}

patch(
  'node_modules/browserslist',
  '4.28.5',
  '4.28.7',
  'https://registry.npmjs.org/browserslist/-/browserslist-4.28.7.tgz',
  'sha512-JxV13hNrFxqjOc8alRbq9dK1MM79NEXYpma2B2J4wAtpWS5zIEIKqWPGCl7N4o7Uc7B7itylh7SuDujATRyyTw==',
  {
    'baseline-browser-mapping': '^2.10.44',
    'caniuse-lite': '^1.0.30001806',
    'electron-to-chromium': '^1.5.393',
    'node-releases': '^2.0.51',
    'update-browserslist-db': '^1.2.3'
  }
);
patch(
  'node_modules/baseline-browser-mapping',
  '2.10.42',
  '2.10.44',
  'https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.44.tgz',
  'sha512-T3ghW+sl/ZJ8w1v/yQx3qvJ9040DWoLBz8JT/CILbAKcFyG9b2MRe75v6W5uXjv6uH1lumK2Kv46y2zSkcej0Q=='
);
patch(
  'node_modules/caniuse-lite',
  '1.0.30001803',
  '1.0.30001806',
  'https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001806.tgz',
  'sha512-72Cuvd95zbSYPKq6Fhg8eDJRlzgWDf7/mtoZv6Qe/DYNCEBdNxoA3+rZAU2ZhGCpZlns3EssFavaZomckT5Uuw=='
);
patch(
  'node_modules/electron-to-chromium',
  '1.5.389',
  '1.5.396',
  'https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.396.tgz',
  'sha512-yHiw2Y3C3H9U6TMbOfoWK/BPreiOPXRfTWPBwQBoZG6/8TB6eOPnsy5oaRYuatR7Fw2SJ4kKforgufeo7fq0EQ=='
);

fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

let doc = fs.readFileSync(docPath, 'utf8');
const oldText = '`fast-uri@3.1.7` e `js-yaml@4.3.1/3.15.1`.';
const newText = '`fast-uri@3.1.7`, `js-yaml@4.3.1/3.15.1` e `browserslist@4.28.7`.';
if (doc.includes(oldText)) doc = doc.replace(oldText, newText);
fs.writeFileSync(docPath, doc);
