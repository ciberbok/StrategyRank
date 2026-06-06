const {
  jaccard,
  resolveReferences,
  formatIndicator,
  collectIndicators,
  correlateStrategies,
  clusterStrategies,
  generateCorrelationReport,
} = require('../src/correlationAnalyzer.js');

describe('correlationAnalyzer basic utilities', () => {
  it('calculates jaccard similarity correctly', () => {
    expect(jaccard([1, 2, 3], [2, 3, 4])).toBeCloseTo(2 / 4);
    expect(jaccard([], [])).toBe(0);
  });

  it('formats indicators with and without params', () => {
    const ind = { mI: 'ATR', params: [{ key: '#Period#', value: '14' }] };
    // parameters are included by default
    expect(formatIndicator(ind)).toContain('ATR|#Period#');
    // explicit false should omit them
    expect(formatIndicator(ind, false)).toBe('ATR');
  });

  it('resolves simple references without cycles', () => {
    const strat = { variableMap: { a: { mI: 'X' } } };
    const placeholder = { reference: true, id: 'a' };
    const res = resolveReferences(placeholder, strat);
    expect(res[0].mI).toBe('X');
  });

  it('avoids infinite loops on cyclic references', () => {
    const strat = { variableMap: {} };
    strat.variableMap.a = { reference: true, id: 'b' };
    strat.variableMap.b = { reference: true, id: 'a' };
    const res = resolveReferences({ reference: true, id: 'a' }, strat);
    expect(res).toEqual([]);
  });
});

describe('collection and correlation on dummy strategies', () => {
  const s1 = { entryIndicators: [{ mI: 'A' }, { mI: 'B' }], priceIndicators: [] };
  const s2 = { entryIndicators: [{ mI: 'B' }, { mI: 'C' }], priceIndicators: [] };
  const s3 = { entryIndicators: [{ mI: 'X' }], priceIndicators: [{ mI: 'Y' }] };
  const strategies = [s1, s2, s3];

  it('collectIndicators returns correct sets', () => {
    const c = collectIndicators(s1, 'entry');
    expect(c.has('A')).toBe(true);
    expect(c.has('B')).toBe(true);
  });

  it('includes parameters in correlation by default', () => {
    const strat1 = { entryIndicators: [{ mI: 'X', params: [{ key: 'p', value: '1' }] }], priceIndicators: [] };
    const strat2 = { entryIndicators: [{ mI: 'X', params: [{ key: 'p', value: '2' }] }], priceIndicators: [] };
    const { matrix } = correlateStrategies([strat1, strat2]);
    expect(matrix[0][1]).toBe(0); // different parameter values -> no similarity
  });

  it('correlateStrategies builds matrix and respects threshold', () => {
    const { matrix } = correlateStrategies(strategies, { threshold: 0.5 });
    expect(matrix[0][1]).toBeCloseTo(1 / 3); // A,B vs B,C intersection size1 union3
  });

  it('clusters strategies correctly', () => {
    const { matrix } = correlateStrategies(strategies, { threshold: 0.1 });
    const clusters = clusterStrategies(matrix, strategies, 0.1);
    // expect s1 and s2 in same cluster because they share B
    expect(clusters.some(c => c.cluster.includes(0) && c.cluster.includes(1))).toBe(true);
  });

  it('selects representative using preferred KPIs when provided', () => {
    // build simple data where s1 and s2 share A and B but s2 has C as extra
    const s1 = { entryIndicators: [{ mI: 'A' }, { mI: 'B' }], priceIndicators: [] };
    const s2 = { entryIndicators: [{ mI: 'A' }, { mI: 'B' }, { mI: 'C' }], priceIndicators: [] };
    const arr = [s1, s2];
    const { matrix } = correlateStrategies(arr, { threshold: 0 });
    // prefer KPI 'B' only; both have it, tie -> fallback chooses s1? but both share count equal
    const clusters1 = clusterStrategies(matrix, arr, 0, { preferredKpis: ['B'] });
    // tie-breaker by total indicators: s2 has 3 vs 2 -> chosen
    expect(clusters1[0].representative).toBe(1);

    // prefer KPI 'C' only; only s2 has it -> must choose 2
    const clusters2 = clusterStrategies(matrix, arr, 0, { preferredKpis: ['C'] });
    expect(clusters2[0].representative).toBe(1);

    // prefer KPI not present; fallback to indicator count => s2
    const clusters3 = clusterStrategies(matrix, arr, 0, { preferredKpis: ['X'] });
    expect(clusters3[0].representative).toBe(1);
  });

  it('generates a report with metrics', () => {
    const { matrix } = correlateStrategies(strategies, { threshold: 0.1 });
    const clusters = clusterStrategies(matrix, strategies, 0.1);
    const report = generateCorrelationReport(strategies, matrix, clusters, { threshold: 0.1 });
    expect(report.summary.totalStrategies).toBe(3);
    expect(report.grouped.length).toBeGreaterThan(0);
  });
});

// integration test that exercises the full correlation pipeline on the real
// strategy files included in the repo. This will catch formatting issues such as
// missing newlines or unquoted labels that previously caused Mermaid parse
// errors in the UI.
describe('correlation integration with sample SQX files', () => {
  const fs = require('fs');
  const path = require('path');
  const {
    buildNetworkGraph,
    toMermaid,
  } = require('../src/graphVisualizer.js');
  const { parseSqxFile } = require('../src/sqxParser.js');

  it('loads all samples and produces well‑formed mermaid markup', async () => {
    const dir = path.resolve(__dirname, '../Strategy samples');
    const files = await fs.promises.readdir(dir);
    const sqxFiles = files.filter(f => f.toLowerCase().endsWith('.sqx'));
    expect(sqxFiles.length).toBeGreaterThan(0);

    const strategies = [];
    for (const fname of sqxFiles) {
      const buf = await fs.promises.readFile(path.join(dir, fname));
      const strat = await parseSqxFile(buf);
      strat.fileName = fname;
      strategies.push(strat);
    }

    // run correlation with zero threshold so all pairs are considered; we just
    // care that the pipeline completes and the mermaid string is formatted.
    const { matrix } = correlateStrategies(strategies, { threshold: 0 });
    const clusters = clusterStrategies(matrix, strategies, 0);
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    const mer = toMermaid(graph);

    // the first line must be "graph TD" followed by a newline
    expect(mer.startsWith('graph TD\n')).toBe(true);

    // each strategy should appear quoted somewhere in the output
    strategies.forEach((s, idx) => {
      const label = (s.name || s.fileName).replace(/"/g, '\\"');
      expect(mer).toMatch(new RegExp(`"${label}"`));
      // the rewritten output uses safe node IDs (`n0`, `n1`, etc.), so make sure
      // those identifiers are present too. this also indirectly verifies that
      // the header line remained unchanged.
      expect(mer).toMatch(new RegExp(`n${idx}\\[`));
    });
  });
});
