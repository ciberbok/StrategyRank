const {
  buildNetworkGraph,
  toMermaid,
  toGraphML,
  toAdjacencyMatrix,
  calculateNetworkStats,
} = require('../src/graphVisualizer.js');

describe('graphVisualizer', () => {
  const strategies = [{name:'A'},{name:'B'}];
  const matrix = [[1,0.5],[0.5,1]];
  const clusters = [{cluster:[0,1], representative:0, redundant:[1]}];

  it('builds a simple graph structure', () => {
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].weight).toBe(0.5);
  });

  it('exports mermaid markup', () => {
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    const mer = toMermaid(graph);
    expect(mer).toContain('graph TD');
    expect(mer).toContain('A');
  });

  it('exports GraphML', () => {
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    const xml = toGraphML(graph);
    expect(xml).toContain('<graphml');
    expect(xml).toContain('<node');
  });

  it('creates adjacency matrix CSV', () => {
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    const csv = toAdjacencyMatrix(graph);
    expect(csv.split('\n').length).toBe(3);
  });

  it('calculates network stats', () => {
    const graph = buildNetworkGraph(clusters, matrix, strategies);
    const stats = calculateNetworkStats(graph);
    expect(stats.nodes).toBe(2);
    expect(stats.density).toBeGreaterThan(0);
  });
});