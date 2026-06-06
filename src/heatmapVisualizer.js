// heatmapVisualizer.js
// Scalable heatmap and analysis panel for large correlation datasets
// Optimized for hundreds of strategies

// some utilities from correlation analyzer used for KPI sets
const { collectIndicators } = require('./correlationAnalyzer');

/**
 * Generate a scalable heatmap visualization with clustering
 * Includes filtering, search, and interactive features
 */
function generateHeatmapHTML(clusters, matrix, strategies, options = {}) {
  const { threshold = 0.6, showOnlyAboveThreshold = true, highlightKpis = [] } = options;
  
  // Build strategy index and find clusters for quick lookup
  const strategyIndex = new Map(strategies.map((s, i) => [i, s]));
  const strategyInCluster = new Map(); // idx -> { clusterId, role }
  
  clusters.forEach((cl, clusterId) => {
    cl.cluster.forEach(idx => {
      strategyInCluster.set(idx, { 
        clusterId, 
        role: idx === cl.representative ? 'representative' : 'redundant'
      });
    });
  });

  // Generate correlation pairs sorted by similarity (only above threshold)
  const correlationPairs = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) {
      const sim = matrix[i][j];
      if (showOnlyAboveThreshold && sim < threshold) continue;
      correlationPairs.push({
        idx1: i,
        idx2: j,
        sim: sim,
        name1: strategies[i].name || strategies[i].fileName || `#${i}`,
        name2: strategies[j].name || strategies[j].fileName || `#${j}`,
      });
    }
  }
  correlationPairs.sort((a, b) => b.sim - a.sim); // highest similarity first

  // Generate heatmap cell data (sparse: only render cells with data)
  const n = strategies.length;
  let heatmapHTML = `
    <div class="heatmap-container">
      <div class="heatmap-search" style="margin-bottom:12px">
        <input type="text" id="heatmapSearch" placeholder="🔍 Search strategies..." 
               style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px"/>
      </div>
      <div class="heatmap-wrapper" style="overflow-x:auto;max-height:400px;border:1px solid var(--border);border-radius:4px">
        <table class="heatmap-table" style="border-collapse:collapse;font-size:11px">
          <tbody id="heatmapBody">
          </tbody>
        </table>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--dim)">
        <span id="heatmapInfo"></span>
      </div>
    </div>
  `;

  // Create correlation pairs table (shows actual redundancies)
  let correlationTableHTML = `
    <div class="correlation-table-container">
      <div style="margin-bottom:8px">
        <h4 style="margin:0 0 8px 0">Correlated Pairs (${correlationPairs.length})</h4>
        <input type="text" id="corrPairSearch" placeholder="Search pairs..." 
               style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:11px"/>
      </div>
      <div style="overflow-y:auto;max-height:350px;border:1px solid var(--border);border-radius:4px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead style="position:sticky;top:0;background:var(--bg-darker);border-bottom:1px solid var(--border)">
            <tr>
              <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">Strategy 1</th>
              <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">Strategy 2</th>
              <th style="padding:6px;text-align:center;width:70px">Similarity</th>
            </tr>
          </thead>
          <tbody id="corrPairBody">
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Populate correlation pairs table
  let pairsTableRowsHTML = correlationPairs.map((p, idx) => {
    const s1Name = escapeHtml(p.name1);
    const s2Name = escapeHtml(p.name2);
    const pct = (p.sim * 100).toFixed(1);
    const color = getHeatColor(p.sim);
    return `
      <tr data-pair-idx="${idx}" data-sim="${p.sim}" class="corr-pair-row">
        <td style="padding:6px;border-right:1px solid var(--border);cursor:pointer" title="${s1Name}">${truncate(s1Name, 30)}</td>
        <td style="padding:6px;border-right:1px solid var(--border);cursor:pointer" title="${s2Name}">${truncate(s2Name, 30)}</td>
        <td style="padding:6px;text-align:center;background:${color};color:${pct > 70 ? '#fff' : '#000'};border-radius:3px;font-weight:bold">${pct}%</td>
      </tr>
    `;
  }).join('');

  // Build cluster summary table
  let clusterSummaryHTML = `
    <div class="cluster-summary-container">
      <div style="margin-bottom:8px">
        <h4 style="margin:0 0 8px 0">Clusters Found (${clusters.length})</h4>
      </div>
      <div style="overflow-y:auto;max-height:300px;border:1px solid var(--border);border-radius:4px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead style="position:sticky;top:0;background:var(--bg-darker);border-bottom:1px solid var(--border)">
            <tr>
              <th style="padding:6px;text-align:center;border-right:1px solid var(--border);width:40px">ID</th>
              <th style="padding:6px;text-align:center;border-right:1px solid var(--border);width:50px">Size</th>
              <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">Representative</th>
              <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">KPIs</th>
              <th style="padding:6px;text-align:center;width:60px">Redundant</th>
            </tr>
          </thead>
          <tbody id="clusterSummaryBody">
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Populate cluster summary
  let clusterRowsHTML = clusters.map((cl, idx) => {
    const rep = cl.representative;
    const repName = escapeHtml(strategies[rep].name || strategies[rep].fileName || `#${rep}`);
    const redundantCount = cl.redundant.length;
    // compute KPI snippet for representative
    const kpis = Array.from(collectIndicators(strategies[rep], 'combined', true));
    const snippet = kpis.slice(0, 3).map(k => {
      const escaped = escapeHtml(k);
      if (highlightKpis.includes(k)) {
        return `<strong>${truncate(escaped, 15)}</strong>`;
      }
      return truncate(escaped, 15);
    }).join(', ');
    return `
      <tr>
        <td style="padding:6px;text-align:center;border-right:1px solid var(--border);font-weight:bold">${idx + 1}</td>
        <td style="padding:6px;text-align:center;border-right:1px solid var(--border)">${cl.cluster.length}</td>
        <td style="padding:6px;border-right:1px solid var(--border);cursor:pointer;color:var(--accent)" title="${repName}">${truncate(repName, 35)}</td>
        <td style="padding:6px;border-right:1px solid var(--border);font-size:10px;color:var(--dim)" title="${escapeHtml(kpis.join(', '))}">${snippet}</td>
        <td style="padding:6px;text-align:center;background:rgba(255,100,100,0.1);border-radius:3px">${redundantCount}</td>
      </tr>
    `;
  }).join('');

  return {
    heatmapHTML,
    heatmapTableRowsHTML: generateHeatmapTableRows(matrix, strategies, correlationPairs),
    pairsTableRowsHTML,
    clusterSummaryHTML,
    clusterRowsHTML,
    correlationTableHTML,
    correlationPairs,
    clusters,
  };
}

/**
 * Generate heatmap table rows (sparse rendering for efficiency)
 */
function generateHeatmapTableRows(matrix, strategies, correlationPairs) {
  if (correlationPairs.length === 0) {
    return '<tr><td colspan="100" style="padding:20px;text-align:center;color:var(--dim)">No correlations above threshold</td></tr>';
  }

  // Show only strategies involved in correlations (avoid empty rows)
  const involvedIndices = new Set();
  correlationPairs.forEach(p => {
    involvedIndices.add(p.idx1);
    involvedIndices.add(p.idx2);
  });
  
  const involvedList = Array.from(involvedIndices).sort();
  const simpleIndex = new Map(involvedList.map((idx, pos) => [idx, pos]));

  let html = '';
  involvedList.forEach((i, row) => {
    html += `<tr data-strategy-idx="${i}">`;
    html += `<td style="padding:4px;font-size:10px;text-align:right;background:var(--bg-darker);border-right:1px solid var(--border);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(strategies[i].name || strategies[i].fileName)}">${truncate(strategies[i].name || strategies[i].fileName || `#${i}`, 25)}</td>`;
    
    involvedList.forEach((j, col) => {
      const sim = i === j ? 1.0 : (i < j ? matrix[i][j] : matrix[j][i]);
      const color = getHeatColor(sim);
      const pct = (sim * 100).toFixed(0);
      html += `<td style="width:40px;height:40px;padding:0;background:${color};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:${sim > 0.7 ? '#fff' : '#000'};border:1px solid var(--border-light);transition:transform 0.1s" title="${strategies[i].name} - ${strategies[j].name}: ${pct}%" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">${sim > 0.5 ? pct : ''}</td>`;
    });
    html += '</tr>';
  });

  return html;
}

/**
 * Color intensity based on correlation (red = high, white = low)
 */
function getHeatColor(similarity) {
  if (similarity === 1.0) return 'rgb(100, 100, 100)'; // diagonal
  const ratio = Math.max(0, Math.min(1, similarity));
  // Interpolate from white (low) to red (high)
  const r = Math.round(255);
  const g = Math.round(255 * (1 - ratio * 0.7));
  const b = Math.round(255 * (1 - ratio * 0.7));
  return `rgb(${r},${g},${b})`;
}

/**
 * Utility to escape HTML characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text, len) {
  return text.length > len ? text.substring(0, len - 1) + '…' : text;
}

/**
 * Generate comprehensive analysis summary
 */
function generateAnalysisSummary(clusters, matrix, strategies) {
  const n = strategies.length;
  const inCluster = new Set();
  clusters.forEach(cl => cl.cluster.forEach(i => inCluster.add(i)));

  const keep = clusters.length; // one representative per cluster
  const skip = n - keep;
  
  // Calculate correlation statistics
  let totalSim = 0;
  let pairsAboveZero = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = matrix[i][j];
      if (sim > 0) {
        totalSim += sim;
        pairsAboveZero++;
      }
    }
  }
  const avgSim = pairsAboveZero > 0 ? (totalSim / pairsAboveZero) : 0;

  return {
    totalStrategies: n,
    clustersFound: clusters.length,
    strategyToKeep: keep,
    strategyToRemove: skip,
    redundancyPercent: n > 0 ? (skip / n * 100).toFixed(1) : 0,
    averageCorrelation: avgSim.toFixed(3),
  };
}

/**
 * Create interactive panel HTML with search and filtering
 */
function createAnalysisPanel(clusters, matrix, strategies, options = {}) {
  const summary = generateAnalysisSummary(clusters, matrix, strategies);
  const { threshold = 0.6, highlightKpis = [] } = options;
  
  const viz = generateHeatmapHTML(clusters, matrix, strategies, { 
    threshold, 
    showOnlyAboveThreshold: true,
    highlightKpis,
  });

  const html = `
    <div class="analysis-panel" style="font-family:monospace;font-size:12px">
      
      <!-- SUMMARY STATS -->
      <div class="summary-stats" style="background:var(--bg-darker);padding:12px;border-radius:4px;margin-bottom:16px">
        <h3 style="margin:0 0 12px 0;color:var(--accent)">📊 Analysis Summary</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="color:var(--dim);font-size:11px">Total Strategies</div>
            <div style="font-size:16px;font-weight:bold;color:var(--accent)">${summary.totalStrategies}</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:11px">Clusters Found</div>
            <div style="font-size:16px;font-weight:bold;color:var(--accent)">${summary.clustersFound}</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:11px">Keep (representatives)</div>
            <div style="font-size:16px;font-weight:bold;color:#4fa">${summary.strategyToKeep}</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:11px">Remove (redundant)</div>
            <div style="font-size:16px;font-weight:bold;color:#f55">${summary.strategyToRemove}</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:11px">Redundancy Rate</div>
            <div style="font-size:16px;font-weight:bold;color:#fa5">${summary.redundancyPercent}%</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:11px">Avg Correlation</div>
            <div style="font-size:16px;font-weight:bold;color:var(--accent)">${summary.averageCorrelation}</div>
          </div>
        </div>
      </div>

      <!-- CLUSTER SUMMARY TAB -->
      <div style="margin-bottom:16px">
        <h3 style="margin:0 0 8px 0">🎯 Clusters (${clusters.length})</h3>
        ${viz.clusterSummaryHTML}
        <tbody id="clusterSummaryBody">
          ${viz.clusterRowsHTML}
        </tbody>
        </table>
      </div>

      <!-- CORRELATION PAIRS TAB -->
      <div style="margin-bottom:16px">
        <h3 style="margin:0 0 8px 0">🔗 Correlated Pairs Ranked (${viz.correlationPairs.length})</h3>
        <div style="overflow-y:auto;max-height:350px;border:1px solid var(--border);border-radius:4px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead style="position:sticky;top:0;background:var(--bg-darker);border-bottom:1px solid var(--border)">
              <tr>
                <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">Strategy 1</th>
                <th style="padding:6px;text-align:left;border-right:1px solid var(--border)">Strategy 2</th>
                <th style="padding:6px;text-align:center;width:80px">Similarity</th>
              </tr>
            </thead>
            <tbody id="corrPairBody">
              ${viz.pairsTableRowsHTML}
            </tbody>
          </table>
        </div>
      </div>

      <!-- EXPORT OPTIONS -->
      <div style="margin-top:16px;padding:12px;background:var(--bg-darker);border-radius:4px">
        <h4 style="margin:0 0 8px 0">📥 Export</h4>
        <button class="btn btn-small" onclick="exportCorrelationCSV('${btoa(JSON.stringify(viz.correlationPairs))}')">CSV (pairs)</button>
        <button class="btn btn-small" onclick="exportClusterJSON('${btoa(JSON.stringify(clusters))}')">JSON (clusters)</button>
        <button class="btn btn-small" onclick="copyToClipboard(document.getElementById('clusterList').textContent)">Copy Clusters</button>
      </div>

      <!-- HIDDEN DATA FOR EXPORT -->
      <div id="clusterList" style="display:none">
${clusters.map((cl, idx) => {
  const rep = strategies[cl.representative].name || strategies[cl.representative].fileName || `#${cl.representative}`;
  const redundant = cl.redundant.map(r => strategies[r].name || strategies[r].fileName || `#${r}`).join(', ');
  return `Cluster ${idx + 1}: Keep "${rep}" | Remove: ${redundant}`;
}).join('\n')}
      </div>

    </div>
  `;

  return html;
}

module.exports = {
  generateHeatmapHTML,
  generateHeatmapTableRows,
  getHeatColor,
  escapeHtml,
  truncate,
  generateAnalysisSummary,
  createAnalysisPanel,
};
