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
   browser storage), run a simple HTTP server in the project directory. For
   development you can also use hot‑reload: install dependencies and start the
   built‑in server:
   
   ```powershell
   cd D:\Documents\GitHub\StrategyRank
   npm install           # one-time setup (jest, live-server, etc.)
   npm run serve         # starts live-server with auto-reload
   ```
   
   then visit `http://localhost:8000/strategy-rank.html` in your browser; any
   changes to HTML/JS files will trigger a reload.

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

## Correlation Analysis (Enhanced)

A powerful tool to analyze technical‑indicator correlations across StrategyQuant `.sqx` exports. The analysis panel provides an interactive interface for identifying and managing strategy redundancy.

### How it works
1. Select one or more `.sqx` strategy files (use the sample folder as a reference).
2. Choose a similarity threshold (default 0.60) and analysis type (entry, price, or combined); parameter values are **always** considered. Optionally select one or more KPIs (indicators) from the multiselect box – the tool will use them to prioritise which strategy in each cluster is kept.
3. Click **Run**.

The tool parses the zipped SQX files, extracts indicators from entry conditions and price formulas, resolves recursive variable references, and calculates pairwise Jaccard similarity scores.

### Output
The analysis panel displays comprehensive insights in an efficient, interactive format:

* **Analysis Summary** — Key metrics at a glance:
  - Total strategies analyzed
  - Number of clusters found
  - Strategies to keep (cluster representatives)
  - Strategies to remove (redundant)
  - Redundancy percentage
  - Average correlation score

* **Clusters Table** — Organized groups of similar strategies:
  - Cluster ID and size
  - Representative strategy (recommended to keep)
  - A short preview of each representative's KPIs (highlighted when matched against your filter)
  - Count of redundant strategies in each cluster

* **Ranked Correlation Pairs** — All correlated pairs sorted by similarity:
  - Each row shows two strategies and their correlation percentage
  - Color-coded similarity indicator (red = high, white = low)
  - Searchable for quick navigation
  - (use the KPI selector above to emphasize particular indicators in the cluster table)

* **Export Options** — Download results for external analysis:
  - CSV export of all correlated pairs
  - JSON export of cluster assignments
  - Copy cluster recommendations to clipboard

### Performance & Scalability
Designed to handle **hundreds to thousands of strategies** efficiently:
- Sparse rendering (only displays strategies with correlations)
- Interactive filtering and search
- No memory-intensive graph rendering (Mermaid replaced)
- Responsive layout optimized for large datasets
- Color-coded similarity visualization for quick pattern recognition

### Libraries used
* [JSZip](https://stuk.github.io/jszip/) for reading the .sqx archives.
* [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) for XML parsing.

### Testing
Jest tests validate the analysis accuracy, summary calculations, and output formatting. Run `npm test` to ensure the correlation engine and visualization components work correctly.

---

Enjoy ranking your strategies!  Contributions are welcome via pull requests.