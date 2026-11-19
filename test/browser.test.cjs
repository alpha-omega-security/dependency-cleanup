const { test } = require('node:test');
const assert = require('node:assert/strict');
const { number, count, intervention, selectRows, orderedRows, safeURL } = require('../docs/app.js');

const rows = [
  { registry: 'example.org', package: 'retired', cleanup_priority_rank: '2', project_status: 'dead', review_status: 'reviewed', reviewed_intervention_type: 'removal', top_two_share_of_sampled_package_counts: '0', package_dependent_repo_count: '0' },
  { registry: 'example.org', package: 'unknown-impact', cleanup_priority_rank: '1', project_status: 'unknown', review_status: 'needs_review', reviewed_intervention_type: 'replacement', top_two_share_of_sampled_package_counts: '', package_dependent_repo_count: '' },
  { registry: 'second.org', package: 'active-deprecated', cleanup_priority_rank: '1', project_status: 'active', registry_package_status: 'deprecated', review_status: 'unreviewed', top_two_share_of_sampled_package_counts: '0.8', package_dependent_repo_count: '2000', suggested_direct_dependent_1: 'Popular-Parent' }
];

test('unknown counts and shares remain distinct from zero', () => {
  for (const value of [null, undefined, '', ' ', 'invalid']) assert.equal(number(value), null);
  assert.equal(count(''), 'Unknown');
  assert.equal(count('0'), '0');
  assert.deepEqual(selectRows(rows, { concentration: 'unknown' }), [rows[1]]);
  assert.deepEqual(selectRows(rows, { concentration: 'lower' }), [rows[0]]);
  assert.deepEqual(selectRows(rows, { concentration: 'high' }), [rows[2]]);
});

test('stale proposals are not presented as current removal or replacement recommendations', () => {
  assert.equal(intervention(rows[1]), 'needs_review');
  assert.deepEqual(selectRows(rows, { intervention: 'replacement' }), []);
  assert.deepEqual(selectRows(rows, { intervention: 'removal' }), [rows[0]]);
  assert.deepEqual(selectRows(rows, { intervention: 'needs_review' }), [rows[1]]);
  assert.equal(intervention({ review_status: 'reviewed', reviewed_intervention_type: 'unknown' }), 'unresolved');
});

test('search includes intermediaries and combines with registry and status filters', () => {
  assert.deepEqual(selectRows(rows, { query: 'popular-parent', status: 'active', registry: 'second.org' }), [rows[2]]);
  assert.deepEqual(selectRows(rows, { query: 'popular-parent', registry: 'example.org' }), []);
});

test('priority remains within registry and unknown usage sorts after recorded zero', () => {
  assert.deepEqual(orderedRows(rows, 'priority', ['example.org', 'second.org']), [rows[1], rows[0], rows[2]]);
  assert.deepEqual(orderedRows(rows, 'usage', ['example.org', 'second.org']), [rows[2], rows[0], rows[1]]);
  assert.equal(rows[0].package, 'retired');
});

test('evidence links reject executable and local URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '//example.org/test', 'https://user:pass@example.org']) assert.equal(safeURL(url), null);
  assert.equal(safeURL('https://example.org/evidence'), 'https://example.org/evidence');
});
