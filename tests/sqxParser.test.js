const fs = require('fs');
const path = require('path');
const { parseSqxFile } = require('../src/sqxParser.js');

describe('sqxParser', () => {
  const samplePath = path.join(__dirname, '..', 'Strategy samples', 'Strategy 1.1.210.sqx');

  it('should load and parse a sample SQX file', async () => {
    const data = fs.readFileSync(samplePath);
    const strategy = await parseSqxFile(data);
    expect(strategy).toBeDefined();
    expect(strategy.entryIndicators).toBeInstanceOf(Array);
    expect(strategy.priceIndicators).toBeInstanceOf(Array);
    // expect at least one entry indicator (ATR changes direction upwards)
    const hasAtrEntry = strategy.entryIndicators.some(i => /ATR/i.test(i.name));
    expect(hasAtrEntry).toBe(true);
    // expect at least one price indicator (Highest or ATR)
    const hasPrice = strategy.priceIndicators.some(i => /ATR|Highest/i.test(i.name));
    expect(hasPrice).toBe(true);
    // variableMap should contain some entries
    expect(Object.keys(strategy.variableMap).length).toBeGreaterThan(0);
  });

  it('should throw when missing xml file', async () => {
    // create an empty zip buffer
    const JSZip = require('jszip');
    const zip = new JSZip();
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(parseSqxFile(buf)).rejects.toThrow(/strategy_Portfolio.xml/);
  });

  it('can correlate two sample strategies', async () => {
    const { correlateStrategies } = require('../src/correlationAnalyzer.js');
    const paths = [
      path.join(__dirname, '..', 'Strategy samples', 'Strategy 1.1.210.sqx'),
      path.join(__dirname, '..', 'Strategy samples', 'Strategy 1.1.221.sqx'),
    ];
    const strats = [];
    for (const p of paths) {
      const data = fs.readFileSync(p);
      strats.push(await parseSqxFile(data));
    }
    const { matrix } = correlateStrategies(strats, { threshold: 0.1 });
    expect(matrix.length).toBe(2);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][1]).toBeGreaterThanOrEqual(0);
  });
});
