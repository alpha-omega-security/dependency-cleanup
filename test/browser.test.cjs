const { test } = require('node:test');
const assert = require('node:assert/strict');
const { number, count, intervention, unresolvedReason, unresolvedReasons, selectRows, orderedRows, safeURL } = require('../docs/app.js');
const { startBrowser } = require('../docs/app.js');

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

test('unresolved groups partition current assessments and keep missing reasons explicit', () => {
  const base = { registry: 'example.org', package: 'helper', review_status: 'reviewed', reviewed_intervention_type: 'unresolved' };
  const grouped = Object.keys(unresolvedReasons).filter(reason => reason !== 'not_grouped').map(reason => ({ ...base, review_unresolved_reason: reason }));
  const missing = [base, { ...base, review_unresolved_reason: 'future_reason' }];
  const stale = { ...grouped[0], review_status: 'needs_review' };
  const resolved = { ...grouped[0], reviewed_intervention_type: 'replacement' };
  const unreviewed = { ...grouped[0], review_status: 'unreviewed' };
  const input = [...grouped, ...missing, stale, resolved, unreviewed];
  for (const row of grouped) assert.deepEqual(selectRows(input, { intervention: `unresolved:${row.review_unresolved_reason}` }), [row]);
  for (const row of [stale, resolved, unreviewed]) assert.equal(unresolvedReason(row), null);
  assert.deepEqual(selectRows(input, { intervention: 'unresolved:not_grouped' }), missing);
  assert.deepEqual(selectRows(input, { intervention: 'unresolved' }), [...grouped, ...missing]);
  assert.deepEqual(selectRows(input, { intervention: 'unresolved:compatibility_unchecked', registry: 'other.org' }), []);
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

test('browser renders registry evidence and explains unscored rows without inventing status', () => {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    get childNodes() { return this.children; }
    set textContent(value) { this.text = value; }
    get textContent() { return [this.text || '', ...this.children.map(child => child.textContent)].join(' '); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    scrollIntoView() {}
  }
  const elements = Object.fromEntries(['filters', 'candidates', 'sort', 'result-count', 'empty', 'page-count', 'previous', 'next'].map(id => [id, new Element('div')]));
  elements.filters.elements = Object.fromEntries(['registry', 'status', 'query', 'intervention', 'concentration'].map(name => [name, new Element('input')]));
  elements.filters.reset = () => Object.values(elements.filters.elements).forEach(element => { element.value = ''; });
  const originalFormData = global.FormData;
  global.FormData = class { constructor(form) { return Object.entries(form.elements).map(([name, element]) => [name, element.value]); } };
  global.document = { getElementById: id => elements[id], createElement: tag => new Element(tag) };
  try {
    const input = [
      { registry: 'npmjs.org', package: 'inflight', cleanup_priority_rank: '1', project_status: 'unknown', registry_package_status: 'deprecated', project_status_reason: 'insufficient_current_evidence', concentration_unavailable_reason: 'dependency_checks_incomplete', review_status: 'unreviewed' },
      { registry: 'npmjs.org', package: 'archived', cleanup_priority_rank: '2', project_status: 'dead', project_status_reason: 'archived', registry_package_status: 'unknown', concentration_unavailable_reason: 'only_retired_intermediaries', related_cleanup_candidates: 'inflight', review_status: 'reviewed', reviewed_intervention_type: 'unresolved', review_unresolved_reason: 'migration_unverified' },
      { registry: 'npmjs.org', package: 'maintenance-lead', cleanup_priority_rank: '3', project_status: 'unknown', maintenance_review_needed: 'true', review_status: 'unreviewed', candidate_decision_reason: 'An existing consumer PR proposes replacing this dependency.' }
    ];
    const before = JSON.stringify(input);
    startBrowser({ rows: input });
    const [deprecated, archived, lead] = elements.candidates.children;
    assert.match(deprecated.textContent, /Deprecated Registry status/);
    assert.match(deprecated.textContent, /Not scored Dependency checks incomplete/);
    for (const element of [deprecated, archived, lead]) { element.open = true; element.listeners.toggle(); }
    assert.match(lead.textContent, /Unknown Maintenance unverified/);
    assert.match(lead.textContent, /activity summaries do not establish whether maintainers responded/);
    assert.doesNotMatch(lead.textContent, /Dead/);
    assert.match(lead.textContent, /Candidate basis An existing consumer PR proposes replacing this dependency/);
    assert.match(deprecated.textContent, /Classifier status Unknown/);
    assert.match(deprecated.textContent, /Upstream identity Not checked/);
    assert.match(archived.textContent, /Registry status Not reported/);
    assert.match(archived.textContent, /Only retired intermediaries in sample/);
    assert.match(archived.textContent, /Unresolved Migration unverified/);
    assert.match(archived.textContent, /suitable migration has not been verified/);
    assert.match(elements.filters.elements.intervention.textContent, /Migration unverified \(1\)/);
    elements.filters.elements.intervention.value = 'unresolved:migration_unverified';
    elements.filters.listeners.input();
    assert.equal(elements.candidates.children.length, 1);
    assert.match(elements.candidates.textContent, /archived/);
    assert.doesNotMatch(archived.textContent, /Commits synced|Issues synced|Discovered via/);
    const button = archived.children[1].children.find(element => element.className === 'evidence-links').children.find(element => element.tag === 'button');
    button.listeners.click();
    assert.equal(elements.candidates.children.length, 1);
    assert.match(elements.candidates.textContent, /inflight/);
    assert.match(elements.filters.elements.intervention.textContent, /Migration unverified \(0\)/);
    assert.equal(JSON.stringify(input), before);
  } finally {
    delete global.document;
    global.FormData = originalFormData;
  }
});
