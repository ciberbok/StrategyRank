// correlationAnalyzer.js
// provide functions to analyze indicator correlations across strategies

// compute Jaccard similarity between two sets (arrays or sets)
function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// recursively resolve variable references to actual indicators
function resolveReferences(indicator, strategy, visited = new Set()) {
  // if indicator is a placeholder with reference flag
  if (indicator && indicator.reference && indicator.id) {
    if (visited.has(indicator.id)) {
      return [];
    }
    visited.add(indicator.id);
    const ref = strategy.variableMap[indicator.id];
    if (ref) {
      return resolveReferences(ref, strategy, visited);
    }
    return [];
  }
  // if indicator itself has id that points to map entry
  if (indicator && indicator.id && strategy.variableMap[indicator.id] && strategy.variableMap[indicator.id] !== indicator) {
    if (visited.has(indicator.id)) return [];
    visited.add(indicator.id);
    return resolveReferences(strategy.variableMap[indicator.id], strategy, visited);
  }
  // base case: return itself
  return [indicator];
}

// produce a canonical string for indicator for comparison
function formatIndicator(indicator, includeParams = true) {
  if (!indicator) return '';
  let base = indicator.mI || indicator.name || indicator.key || '';
  if (includeParams && indicator.params && indicator.params.length) {
    const sorted = [...indicator.params]
      .map(p => `${p.key}:${p.value}`)
      .sort()
      .join('|');
    base += `|${sorted}`;
  }
  return base;
}

// collect all indicators of a given type from a strategy, resolving references
function collectIndicators(strategy, type = 'combined', includeParams = true) {
  let list = [];
  if (type === 'entry' || type === 'combined') {
    list = list.concat(strategy.entryIndicators || []);
  }
  if (type === 'price' || type === 'combined') {
    list = list.concat(strategy.priceIndicators || []);
  }
  const resolved = [];
  list.forEach(ind => {
    const res = resolveReferences(ind, strategy, new Set());
    res.forEach(r => {
      resolved.push(formatIndicator(r, includeParams));
    });
  });
  return new Set(resolved.filter(x => x));
}

// compute correlation matrix for an array of strategies
function correlateStrategies(strategies, options = {}) {
  const {
    type = 'combined',
    threshold = 0.6,
    includeParams = true,
  } = options;

  const n = strategies.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const setA = collectIndicators(strategies[i], type, includeParams);
      const setB = collectIndicators(strategies[j], type, includeParams);
      const sim = jaccard(setA, setB);
      matrix[i][j] = matrix[j][i] = sim;
    }
    matrix[i][i] = 1;
  }
  return { matrix, threshold };
}

// cluster strategies based on correlation threshold using DFS
function clusterStrategies(matrix, strategies, threshold = 0.6, options = {}) {
  const { preferredKpis = [] } = options;
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const clusters = [];

  function dfs(i, cluster) {
    visited[i] = true;
    cluster.push(i);
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[i][j] >= threshold) {
        dfs(j, cluster);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const cluster = [];
      dfs(i, cluster);
      clusters.push(cluster);
    }
  }
  // choose representative; if preferredKpis provided, pick the member with highest
  // count of those KPIs, otherwise fall back to total indicator count.
  const results = clusters.map(cluster => {
    let repIndex = cluster[0];
    let bestScore = -1; // track either KPI matches or indicator count
    cluster.forEach(idx => {
      // determine base indicators set
      const indSet = collectIndicators(strategies[idx], 'combined', true);
      let score;
      if (preferredKpis && preferredKpis.length) {
        score = preferredKpis.reduce((sum, k) => sum + (indSet.has(k) ? 1 : 0), 0);
      } else {
        score = indSet.size;
      }
      if (score > bestScore) {
        bestScore = score;
        repIndex = idx;
      } else if (score === bestScore && preferredKpis && preferredKpis.length) {
        // tie-break by total indicator count
        const currentCount = (indSet.size);
        const bestCount = collectIndicators(strategies[repIndex], 'combined', true).size;
        if (currentCount > bestCount) {
          repIndex = idx;
        }
      }
    });
    const redundant = cluster.filter(idx => idx !== repIndex);
    return { cluster, representative: repIndex, redundant };
  });
  return results;
}

// generate a detailed correlation report
function generateCorrelationReport(strategies, matrix, clusters, options = {}) {
  const { type = 'combined', threshold = 0.6 } = options;
  const report = { grouped: [], unique: [], summary: {} };

  const n = strategies.length;
  const inCluster = new Set();
  clusters.forEach(cl => cl.cluster.forEach(i => inCluster.add(i)));

  clusters.forEach((cl, idx) => {
    const rep = cl.representative;
    const sharedEntry = [];
    const sharedPrice = [];
    // compute shared indicators across cluster
    const sets = cl.cluster.map(i => collectIndicators(strategies[i], 'combined'));
    const common = sets.reduce((a,b)=>new Set([...a].filter(x=>b.has(x))));
    report.grouped.push({
      clusterId: idx,
      size: cl.cluster.length,
      representative: rep,
      redundant: cl.redundant.map(i => ({ index: i, similarity: matrix[rep][i] })),
      shared: Array.from(common),
    });
  });

  // unique strategies
  for (let i = 0; i < n; i++) {
    if (!inCluster.has(i)) {
      report.unique.push({
        index: i,
        indicators: Array.from(collectIndicators(strategies[i], 'combined')),
      });
    }
  }

  // summary metrics
  const total = n;
  const keep = clusters.reduce((sum, cl) => sum + 1, 0); // one per cluster
  const skip = total - keep;
  report.summary = {
    totalStrategies: total,
    toKeep: keep,
    toSkip: skip,
    redundancy: total > 0 ? (skip / total) : 0,
  };

  return report;
}

module.exports = {
  jaccard,
  resolveReferences,
  formatIndicator,
  collectIndicators,
  correlateStrategies,
  clusterStrategies,
  generateCorrelationReport,
};
