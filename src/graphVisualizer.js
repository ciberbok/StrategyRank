// graphVisualizer.js
// utilities for creating network graph structures and exporting formats

// build simple graph from clusters and matrix
// graph: { nodes: [{id,index,label}], edges: [{source,target,weight}] }
function buildNetworkGraph(clusters, matrix, strategies) {
  const n = matrix.length;
  const nodes = strategies.map((s, idx) => {
    const label = s.name || s.fileName || `#${idx}`;
    return { id: idx.toString(), index: idx, label };
  });
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = matrix[i][j];
      if (w > 0) {
        edges.push({ source: i.toString(), target: j.toString(), weight: w });
      }
    }
  }
  return { nodes, edges };
}

// convert graph structure to Mermaid markdown
function toMermaid(graph) {
  const lines = ['graph TD'];
  graph.edges.forEach(e => {
    const pct = (e.weight * 100).toFixed(0);
    // original labels (escaped) to display inside the node
    const srcLab = graph.nodes[e.source].label.replace(/"/g,'\\"');
    const tgtLab = graph.nodes[e.target].label.replace(/"/g,'\\"');
    // safe node IDs (use the index with prefix); these cannot contain spaces
    const srcId = 'n' + graph.nodes[e.source].index;
    const tgtId = 'n' + graph.nodes[e.target].index;
    // use Mermaid's bracket syntax to assign a label with spaces
    lines.push(`  ${srcId}["${srcLab}"] -->|${pct}%| ${tgtId}["${tgtLab}"]`);
  });
  return lines.join('\n');
}

// convert graph to GraphML string
function toGraphML(graph) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
  lines.push('         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  lines.push('         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns');
  lines.push('         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');
  lines.push('  <graph id="G" edgedefault="undirected">');
  graph.nodes.forEach(n => {
    lines.push(`    <node id="${n.id}"><data key="label">${n.label}</data></node>`);
  });
  graph.edges.forEach((e, idx) => {
    lines.push(`    <edge id="e${idx}" source="${e.source}" target="${e.target}"><data key="weight">${e.weight}</data></edge>`);
  });
  lines.push('  </graph>');
  lines.push('</graphml>');
  return lines.join('\n');
}

// adjacency matrix CSV
function toAdjacencyMatrix(graph) {
  const n = graph.nodes.length;
  // use readable labels in the header and row prefixes; escape double-quotes
  const esc = s => (`"${String(s).replace(/"/g, '""')}"`);
  const header = [''].concat(graph.nodes.map(n => esc(n.label)));
  const rows = [header.join(',')];
  const weightMap = new Map();
  graph.edges.forEach(e => {
    weightMap.set(`${e.source}-${e.target}`, e.weight);
    weightMap.set(`${e.target}-${e.source}`, e.weight);
  });
  graph.nodes.forEach(src => {
    const row = [esc(src.label)];
    graph.nodes.forEach(tgt => {
      const w = weightMap.get(`${src.id}-${tgt.id}`) || 0;
      row.push(w);
    });
    rows.push(row.join(','));
  });
  return rows.join('\n');
}

// compute simple network statistics
function calculateNetworkStats(graph) {
  const n = graph.nodes.length;
  const m = graph.edges.length;
  // density = 2m / n(n-1)
  const density = n > 1 ? (2 * m) / (n * (n - 1)) : 0;
  return { nodes: n, edges: m, density };
}

module.exports = {
  buildNetworkGraph,
  toMermaid,
  toGraphML,
  toAdjacencyMatrix,
  calculateNetworkStats,
};
