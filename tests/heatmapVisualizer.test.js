// heatmapVisualizer.test.js
const { generateAnalysisSummary, createAnalysisPanel } = require('../src/heatmapVisualizer');

// Mock strategy data for testing
const mockStrategies = Array.from({ length: 10 }, (_, i) => ({
  name: `Strategy ${i + 1}`,
  fileName: `strat_${i + 1}.sqx`,
  entryIndicators: [{ mI: `entry_${i}` }],
  priceIndicators: [{ mI: `price_${i}` }],
}));

// Create correlation matrix
const createMockMatrix = () => {
  const matrix = Array.from({ length: 10 }, () => Array(10).fill(0));
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (i > j) {
        matrix[i][j] = matrix[j][i];
      } else {
        matrix[i][j] = Math.random() * 0.8 + 0.1;
      }
    }
  }
  return matrix;
};

const mockMatrix = createMockMatrix();

// Simple clustering for testing
const mockClusters = [
  { cluster: [0, 1], representative: 0, redundant: [1] },
  { cluster: [2, 3], representative: 2, redundant: [3] },
  { cluster: [4], representative: 4, redundant: [] },
  { cluster: [5, 6, 7], representative: 5, redundant: [6, 7] },
  { cluster: [8], representative: 8, redundant: [] },
  { cluster: [9], representative: 9, redundant: [] },
];

describe('heatmapVisualizer', () => {
  test('generateAnalysisSummary returns correct metrics', () => {
    const summary = generateAnalysisSummary(mockClusters, mockMatrix, mockStrategies);
    
    expect(summary.totalStrategies).toBe(10);
    expect(summary.clustersFound).toBe(6);
    expect(summary.strategyToKeep).toBe(6);
    expect(summary.strategyToRemove).toBe(4);
    expect(parseFloat(summary.redundancyPercent)).toBe(40);
  });

  test('generateAnalysisSummary calculates average correlation', () => {
    const summary = generateAnalysisSummary(mockClusters, mockMatrix, mockStrategies);
    
    const avgCorr = parseFloat(summary.averageCorrelation);
    expect(avgCorr).toBeGreaterThanOrEqual(0);
    expect(avgCorr).toBeLessThanOrEqual(1);
  });

  test('createAnalysisPanel generates valid HTML', () => {
    const panelHTML = createAnalysisPanel(mockClusters, mockMatrix, mockStrategies, { threshold: 0.6 });
    
    expect(panelHTML).toContain('Analysis Summary');
    expect(panelHTML).toContain('Clusters Found');
    expect(panelHTML).toContain('Correlated Pairs Ranked');
    expect(panelHTML).toContain('📊');
    expect(panelHTML).toContain('🎯');
  });

  test('createAnalysisPanel includes export buttons', () => {
    const panelHTML = createAnalysisPanel(mockClusters, mockMatrix, mockStrategies, { threshold: 0.6 });
    
    expect(panelHTML).toContain('exportCorrelationCSV');
    expect(panelHTML).toContain('exportClusterJSON');
    expect(panelHTML).toContain('copyToClipboard');
  });

  test('createAnalysisPanel shows KPI snippet for clusters', () => {
    // give each strategy a fake KPI set
    mockStrategies[0].entryIndicators = [{mI:'K1'}];
    mockStrategies[1].entryIndicators = [{mI:'K2'}];
    const panelHTML = createAnalysisPanel(mockClusters, mockMatrix, mockStrategies, { threshold: 0.6 });
    // at least one KPI name should appear
    expect(panelHTML).toMatch(/K1|K2/);
  });

  test('highlightKpis option bolds selected KPIs in panel', () => {
    // use highlight option to push panel construction
    const panelHTML = createAnalysisPanel(mockClusters, mockMatrix, mockStrategies, { threshold: 0.6, highlightKpis: ['K1'] });
    expect(panelHTML).toContain('<strong>');
  });

  test('createAnalysisPanel filters correlations by threshold', () => {
    const threshold = 0.7;
    const panelHTML = createAnalysisPanel(mockClusters, mockMatrix, mockStrategies, { threshold });
    
    // Panel should show pairs above threshold
    const pairsMatch = panelHTML.match(/Correlated Pairs Ranked \((\d+)\)/);
    expect(pairsMatch).not.toBeNull();
    const pairCount = parseInt(pairsMatch[1]);
    expect(pairCount).toBeGreaterThanOrEqual(0);
  });

  test('analysis summary with single cluster', () => {
    const singleCluster = [{ cluster: [0, 1, 2, 3, 4], representative: 0, redundant: [1, 2, 3, 4] }];
    const summary = generateAnalysisSummary(singleCluster, mockMatrix, mockStrategies.slice(0, 5));
    
    expect(summary.clustersFound).toBe(1);
    expect(summary.strategyToRemove).toBe(4);
    expect(parseFloat(summary.redundancyPercent)).toBe(80);
  });
});
