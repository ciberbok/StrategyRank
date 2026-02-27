# StrategyRank

This repository hosts a single-page web application that ranks strategies based on percentile-normalized KPIs. The core logic lives inside `strategy-rank.html`.

## Running Tests

A Node-based testing harness has been added to verify the scoring engine and utility functions. To run the unit tests:

```bash
npm install          # install dev dependencies (jest)
npm test             # execute the test suite
```

Tests exercise percentile ranking, weight distribution, and the ranking computation to ensure future changes do not break existing functionality.

## Viewing and Using the App

Because the application is entirely static it can be opened directly in any modern
browser. Follow these steps:

1. Open `strategy-rank.html` in Chrome/Edge/Firefox/Safari by double-clicking the
   file or using **File → Open**.
2. (Optional) If you encounter permission issues (e.g. loading CSVs or using
   browser storage), run a simple HTTP server in the project directory:
   
   ```powershell
   cd D:\Documents\GitHub\StrategyRank
   python -m http.server 8000   # or `npx http-server` etc.
   ```
   
   then visit `http://localhost:8000/strategy-rank.html`.

3. Drag‑and‑drop or select a CSV containing one strategy per row. Numeric columns
   are auto‑detected and presented as KPIs. Select the desired KPIs, assign
   weights/directions, and click **CALCULATE RANKING**. Results display in a
   sortable table and can be exported to CSV.

Session state (loaded data, selected KPIs, weights, annotations, language) is
persisted automatically in browser storage. KPI profiles can be saved/restored
locally or exported/imported as JSON.

## Development Notes

* Core ranking logic is in `src/ranker.js`; this module is used by the test harness
  but is *not* required by the HTML page (its logic is duplicated in the `<script>`).
* UI and CSV parsing are contained wholly within `strategy-rank.html`; no build
  step is necessary.
* The repository currently has no backend or build toolchain – adding one would
  be straightforward if you wanted to convert the page to a React/Vue app, for
  example.

## Git Repository

Local edits can be committed using standard Git commands. Example:

```bash
cd D:\Documents\GitHub\StrategyRank
git add src/ tests/ README.md package.json
git commit -m "Add unit tests and documentation; isolate core logic"
```

If a remote is configured, `git push` will update it accordingly.

---

Enjoy ranking your strategies!  Contributions are welcome via pull requests.