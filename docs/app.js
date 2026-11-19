'use strict';

const registryNames = { 'rubygems.org': 'RubyGems', 'npmjs.org': 'npm', 'pypi.org': 'PyPI', 'proxy.golang.org': 'Go', 'crates.io': 'crates.io', 'packagist.org': 'Packagist', 'repo1.maven.org': 'Maven' };
const reviewNames = { removal: 'Removal', replacement: 'Replacement', unresolved: 'Unresolved', needs_review: 'Needs review', unreviewed: 'Unreviewed' };
const number = value => value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const human = value => value ? value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'Unknown';
const count = value => number(value) === null ? 'Unknown' : number(value).toLocaleString('en');

function intervention(row) {
  if (row.review_status !== 'reviewed') return row.review_status === 'needs_review' ? 'needs_review' : 'unreviewed';
  return ['removal', 'replacement'].includes(row.reviewed_intervention_type) ? row.reviewed_intervention_type : 'unresolved';
}

function selectRows(rows, filters) {
  const query = (filters.query || '').trim().toLowerCase();
  return rows.filter(row => {
    const share = number(row.top_two_share_of_sampled_package_counts);
    const text = [row.package, row.registry, row.purl, row.suggested_direct_dependent_1, row.suggested_direct_dependent_2].join(' ').toLowerCase();
    return (!query || text.includes(query)) && (!filters.registry || row.registry === filters.registry) &&
      (!filters.status || (row.project_status || 'unknown') === filters.status) &&
      (!filters.intervention || intervention(row) === filters.intervention) &&
      (!filters.concentration || (filters.concentration === 'unknown' ? share === null :
        share !== null && (filters.concentration === 'high' ? share >= 0.8 : share < 0.8)));
  });
}

function orderedRows(rows, order, registries) {
  return [...rows].sort((a, b) => {
    if (order === 'name') return a.package.localeCompare(b.package) || a.registry.localeCompare(b.registry);
    if (order === 'usage') {
      const left = number(a.package_dependent_repo_count), right = number(b.package_dependent_repo_count);
      if (left !== right) return left === null ? 1 : right === null ? -1 : right - left;
    }
    return registries.indexOf(a.registry) - registries.indexOf(b.registry) ||
      (number(a.cleanup_priority_rank) ?? Infinity) - (number(b.cleanup_priority_rank) ?? Infinity) || a.package.localeCompare(b.package);
  });
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function startBrowser(report) {
  const rows = report.rows;
  const registries = [...new Set(rows.map(row => row.registry))];
  const form = document.getElementById('filters');
  const results = document.getElementById('candidates');
  const sort = document.getElementById('sort');
  const pageSize = 40;
  let page = 0;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const tag = (text, name) => el('span', text, `tag tag-${name}`);
  const detailList = (title, pairs) => {
    const section = el('section');
    section.append(el('h3', title));
    const list = el('dl');
    pairs.forEach(([label, value]) => list.append(el('dt', label), el('dd', value || 'Unknown')));
    section.append(list);
    return section;
  };
  const date = value => value ? value.slice(0, 10) : 'Unknown';
  const option = (select, value, label) => {
    const node = el('option', label);
    node.value = value;
    select.append(node);
  };
  registries.forEach(registry => option(form.elements.registry, registry, `${registryNames[registry] || registry} (${rows.filter(r => r.registry === registry).length})`));
  [...new Set(rows.map(row => row.project_status || 'unknown'))].sort().forEach(status => option(form.elements.status, status, human(status)));

  function candidate(row) {
    const item = el('details', undefined, 'candidate');
    const summary = el('summary', undefined, 'candidate-summary');
    const identity = el('div');
    identity.append(el('span', row.package, 'package-name'), el('span', `${registryNames[row.registry] || row.registry} · priority ${row.cleanup_priority_rank || 'unknown'} within registry`, 'meta'));
    const status = el('div');
    status.append(tag(human(row.project_status), row.project_status || 'unknown'));
    status.append(el('span', row.registry_package_status && row.registry_package_status !== 'unknown' ? `Registry: ${row.registry_package_status}` : human(row.project_status_reason), 'meta'));
    const parents = el('div');
    [1, 2].forEach(index => {
      if (row[`suggested_direct_dependent_${index}`]) parents.append(el('span', row[`suggested_direct_dependent_${index}`], 'dependent-name'));
    });
    if (!parents.childNodes.length) parents.append(el('span', 'None identified', 'meta'));
    const concentration = el('div');
    const share = number(row.top_two_share_of_sampled_package_counts);
    concentration.append(el('span', share === null ? 'Unknown' : `${(share * 100).toFixed(share * 100 % 1 ? 1 : 0)}%`, share !== null && share >= .8 ? 'share share-high' : 'share'));
    concentration.append(el('span', row.dependent_collection_complete === 'true' ? 'List exhausted' : 'Partial / unknown coverage', 'meta'));
    const review = el('div');
    const action = intervention(row);
    review.append(tag(reviewNames[action], action), el('span', 'Open details', 'meta'));
    summary.append(identity, status, parents, concentration, review);
    item.append(summary);
    item.addEventListener('toggle', () => {
      if (!item.open || item.children.length > 1) return;
      const body = el('div', undefined, 'candidate-body');
      const grid = el('div', undefined, 'detail-grid');
      grid.append(detailList('Maintenance evidence', [
        ['Classifier status', human(row.project_status)], ['Classification reason', human(row.project_status_reason)],
        ['Registry status', human(row.registry_package_status)], ['Classified', date(row.classified_at)],
        ['Package synced', date(row.package_synced_at)], ['Repository synced', date(row.repository_synced_at)],
        ['Commits synced', date(row.commits_synced_at)], ['Issues synced', date(row.issues_synced_at)],
        ['Release used', date(row.release_date_used_for_classification)],
        ['Upstream identity', row.upstream_identity_confirmed === 'true' ? 'Confirmed' : row.upstream_identity_confirmed === 'false' ? 'Unconfirmed' : 'Unknown'],
        ['Signals', row.status_signals], ['Discovery', human(row.discovery_source)], ['Discovered via', row.discovered_via]
      ]));
      const units = row.ranking_count === 'dependent_repos_count' ? 'repositories' : row.ranking_count === 'dependent_packages_count' ? 'packages' : 'unknown units';
      const usage = [
        ['Dependent repositories', count(row.package_dependent_repo_count)], ['Dependent packages', count(row.package_dependent_package_count)],
        ['Downloads', `${count(row.package_download_count)} (${row.package_download_period || 'period unknown'})`],
        ['Top two count sum', `${count(row.top_two_dependent_package_count_sum)} ${units}`],
        ['Dependents sampled', count(row.direct_dependents_sampled)], ['Collection', row.dependent_collection_complete === 'true' ? 'Complete indexed list' : 'Partial or unknown'],
        ['Pagination stopped', human(row.pagination_stop_reason)], ['Kinds checked', row.dependency_kinds],
        ['Dependency data fetched', date(row.dependency_fetched_at)]
      ];
      [1, 2].forEach(index => {
        const name = row[`suggested_direct_dependent_${index}`];
        if (name) usage.push([name, `${count(row[`suggested_direct_dependent_${index}_package_count`])} dependent packages; ${count(row[`suggested_direct_dependent_${index}_repo_count`])} repositories`]);
      });
      if (row.depends_on_candidates) usage.push(['Candidate dependencies', row.depends_on_candidates]);
      if (row.related_cleanup_candidates) usage.push(['Related candidates', row.related_cleanup_candidates]);
      grid.append(detailList('Usage and suggested dependents', usage));
      body.append(grid);
      const reviewText = action === 'needs_review' ? `Earlier proposal: ${human(row.reviewed_intervention_type)}. Needs review: ${human(row.review_changes)}.` :
        action === 'unreviewed' ? 'No intervention review is recorded.' : `Current review: ${reviewNames[action]}.`;
      body.append(el('p', `${reviewText}${row.review_notes ? `\n${row.review_notes}` : ''}`, 'review-note'));
      const links = el('div', undefined, 'evidence-links');
      const addLink = (label, value) => {
        const href = safeURL(value);
        if (!href) return;
        const link = el('a', label);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      };
      addLink('Upstream repository', row.repository_url);
      addLink('Dependency source', row.dependency_source);
      (row.review_sources || '').split(' ; ').filter(Boolean).forEach((source, index) => addLink(`Review source ${index + 1}`, source));
      body.append(links);
      body.append(el('p', row.purl, 'meta'));
      item.append(body);
    });
    return item;
  }

  function render() {
    const filters = Object.fromEntries(new FormData(form));
    const selected = orderedRows(selectRows(rows, filters), sort.value, registries);
    const pages = Math.max(1, Math.ceil(selected.length / pageSize));
    page = Math.min(page, pages - 1);
    results.replaceChildren(...selected.slice(page * pageSize, (page + 1) * pageSize).map(candidate));
    document.getElementById('result-count').textContent = `${count(selected.length)} of ${count(rows.length)} candidates`;
    document.getElementById('empty').hidden = selected.length > 0;
    document.getElementById('page-count').textContent = `Page ${page + 1} of ${pages}`;
    document.getElementById('previous').disabled = page === 0;
    document.getElementById('next').disabled = page >= pages - 1;
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { page = 0; render(); });
  form.addEventListener('reset', () => { setTimeout(() => { page = 0; sort.value = 'priority'; render(); }, 0); });
  sort.addEventListener('change', () => { page = 0; render(); });
  document.getElementById('previous').addEventListener('click', () => { page--; render(); results.scrollIntoView({ block: 'start' }); });
  document.getElementById('next').addEventListener('click', () => { page++; render(); results.scrollIntoView({ block: 'start' }); });
  render();
}

if (typeof module !== 'undefined') module.exports = { number, count, intervention, selectRows, orderedRows, safeURL };
if (typeof document !== 'undefined') startBrowser(window.CLEANUP_REPORT);
