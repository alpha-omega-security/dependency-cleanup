# Dependency cleanup candidates

Browse packages where maintenance work could reduce widespread reliance on potentially obsolete or unmaintained dependencies. Search by package or intermediary, filter by registry and review outcome, and open a candidate for its maintenance evidence and source dates.

The November 2026 snapshot contains 792 candidates across seven registries. Priority is calculated within each registry. Intermediary popularity is a discovery heuristic; overlapping dependency paths and historical releases prevent treating it as predicted removal impact.

This repository contains the static browser and an exported snapshot. Collection, classification and ranking run separately in the cohort research code. The page makes no API requests and needs no build step.

Open `docs/index.html` locally, or serve `docs/` on a static host. GitHub Pages publishes `docs/` from `main`; `.nojekyll` keeps the files unchanged.

Run the tests with Node installed:

```sh
node --test test/*.test.cjs
```

To refresh the snapshot, export a new candidate browser from the scanner and copy its two data files:

```sh
cp /path/to/export/data.js /path/to/export/candidates.csv docs/
node --test test/*.test.cjs
```

Commit the refreshed data to publish it. Keep both files from the same export. The CSV retains provenance references to the original research reports; those reports are separate from this website.

The website code is [MIT licensed](LICENSE), following the org's heatmap project. The dataset is adapted from [ecosyste.ms](https://ecosyste.ms/) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with project-status classifications, candidate ordering and manual assessments added by the research pipeline. Its colour palette follows the [ecosyste.ms style guide](https://ecosyste.ms/styleguide).
