# Dependency cleanup candidates

Browse packages where maintenance work could reduce widespread reliance on potentially obsolete or unmaintained dependencies. Search by package or intermediary, filter by registry and review outcome, and open a candidate for its maintenance evidence and source dates.

The November 2026 snapshot contains 485 candidates across seven registries. Each has a recorded basis for investigation, including 44 without retirement metadata. Another 296 leads need more evidence, and 10 have rejected cleanup rationales; both sets remain available as CSV downloads with their assessments. Priority is calculated within each registry. Intermediary counts can overlap and include historical releases, so they do not predict removal impact.

This repository contains the static browser and an exported snapshot. Collection, classification and ranking run separately in the cohort research code. The page makes no API requests and needs no build step.

Open `docs/index.html` locally, or serve `docs/` on a static host. GitHub Pages publishes `docs/` from `main`; `.nojekyll` keeps the files unchanged.

Run the tests with Node installed:

```sh
node --test test/*.test.cjs
```

To refresh the snapshot, export a new candidate browser from the scanner and copy its data files:

```sh
cp /path/to/export/data.js /path/to/export/*.csv docs/
node --test test/*.test.cjs
```

Commit the refreshed data to publish it. Keep all data files from the same export. The CSV retains provenance references to the original research reports; those reports are separate from this website.

The website code is [MIT licensed](LICENSE), following the org's heatmap project. The dataset is adapted from [ecosyste.ms](https://ecosyste.ms/) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with project-status classifications, candidate ordering and manual assessments added by the research pipeline. Its colour palette follows the [ecosyste.ms style guide](https://ecosyste.ms/styleguide).
