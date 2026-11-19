const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { selectRows, orderedRows } = require('../docs/app.js');
const docs = path.join(__dirname, '../docs');
const script = fs.readFileSync(path.join(docs, 'data.js'), 'utf8');
const report = JSON.parse(script.replace(/^window\.CLEANUP_REPORT = /, '').replace(/;\s*$/, ''));

test('export includes unique candidate identities and preserves within-registry priority', () => {
  assert.ok(report.rows.length > 0);
  const identities = report.rows.map(row => JSON.stringify([row.registry, row.package]));
  assert.equal(new Set(identities).size, identities.length);
  const registries = [...new Set(report.rows.map(row => row.registry))];
  for (const registry of registries) {
    const rows = selectRows(report.rows, { registry });
    assert.deepEqual(orderedRows(rows, 'priority', registries), rows);
  }
});

test('static assets resolve under a GitHub Pages project path', () => {
  const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  for (const reference of references.filter(value => !value.startsWith('https://'))) {
    assert.ok(!reference.startsWith('/'), reference);
    assert.ok(fs.statSync(path.join(docs, reference)).isFile(), reference);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const app = fs.readFileSync(path.join(docs, 'app.js'), 'utf8');
  for (const [, id] of app.matchAll(/getElementById\('([^']+)'\)/g)) assert.ok(ids.includes(id), id);
  assert.ok(fs.existsSync(path.join(docs, '.nojekyll')));
});
