const { pctRank, computeScores, autoDistribute } = require('../src/ranker');

describe('pctRank', () => {
  test('single element returns 0.5', () => {
    expect(pctRank([42], 42)).toBeCloseTo(0.5);
  });

  test('strictly increasing values', () => {
    const sorted = [10, 20, 30, 40];
    // based on formula (below + eq/2) / (n-1)
    expect(pctRank(sorted, 10)).toBeCloseTo((0 + 0.5) / 3);
    expect(pctRank(sorted, 20)).toBeCloseTo((1 + 0.5) / 3);
    expect(pctRank(sorted, 30)).toBeCloseTo((2 + 0.5) / 3);
    expect(pctRank(sorted, 40)).toBeCloseTo((3 + 0.5) / 3);
  });

  test('values with ties', () => {
    const sorted = [1, 1, 2, 2, 3];
    // for value 1: below=0, eq=2 -> (0+1)/4 = 0.25
    expect(pctRank(sorted, 1)).toBeCloseTo(0.25);
    // for value 2: below=2, eq=2 -> (2+1)/4 = 0.75
    expect(pctRank(sorted, 2)).toBeCloseTo(0.75);
    // for value 3: below=4, eq=1 -> (4+0.5)/4 = 1.125 but capped by formula -> (4+0.5)/4 = 1.125?? actually (below+eq/2)/(len-1) => (4+0.5)/4 = 1.125
    // note: unlike typical percentile, may exceed 1 for last element when duplicates present; we keep original calculation
    expect(pctRank(sorted, 3)).toBeCloseTo(1.125);
  });
});

describe('autoDistribute', () => {
  test('even distribution with remainder', () => {
    const kpis = ['a', 'b', 'c'];
    const weights = autoDistribute(kpis);
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(100);
    // first KPI should get the same or slightly larger weight than others
    expect(weights.a).toBeGreaterThanOrEqual(weights.b - 1e-6);
  });

  test('empty input returns empty object', () => {
    expect(autoDistribute([])).toEqual({});
  });
});

// helper to create a row from object
function r(obj) { return { ...obj }; }

describe('computeScores', () => {
  const rows = [
    r({ name: 'x', a: 10, b: 100 }),
    r({ name: 'y', a: 20, b: 50 }),
    r({ name: 'z', a: 20, b: 0 }),
  ];

  const selKpis = ['a', 'b'];
  const kpiCfg = {
    a: { weight: 50, dir: 'more' },
    b: { weight: 50, dir: 'less' },
  };

  test('basic scoring and order', () => {
    const ranked = computeScores(rows, selKpis, kpiCfg);
    expect(ranked.length).toBe(3);
    // order the names from highest to lowest score to assert correctness
    const order = ranked.map(r => r.name);
    // compute expected manually: 'y' has high a and mid b, 'z' has same a but lowest b,
    // so when b is "less is better" z should outrank y. x has lowest a and highest b.
    expect(order).toEqual(['z', 'y', 'x']);

    ranked.forEach(r => {
      expect(r.__score).toBeGreaterThanOrEqual(0);
      expect(r.__score).toBeLessThanOrEqual(100);
    });
  });

  test('scores reflect direction inversion', () => {
    // compute percentiles manually for sanity
    const ranked = computeScores(rows, selKpis, kpiCfg);
    // check that when b is less-is-better, lower b leads to higher percentile
    const pct_y_b = ranked.find(r => r.name === 'y').__pcts.b;
    const pct_z_b = ranked.find(r => r.name === 'z').__pcts.b;
    expect(pct_z_b).toBeGreaterThan(pct_y_b);
  });

  test('ignores non-numeric values gracefully', () => {
    const badRows = [r({val: 'foo'}), r({val: 10}), r({val: 20})];
    const out = computeScores(badRows, ['val'], {val:{weight:100,dir:'more'}});
    // after sorting highest score comes first; the NaN row should be last and have score 0
    const last = out[out.length - 1];
    expect(last.__idx).toBe(0);
    expect(last.__score).toBe(0);
    expect(out[0].__score).toBeGreaterThan(out[1].__score);
  });

  test('single row returns 50 score when weight 100', () => {
    const single = [r({a: 123})];
    const out = computeScores(single, ['a'], {a:{weight:100,dir:'more'}});
    expect(out.length).toBe(1);
    expect(out[0].__score).toBeCloseTo(50);
  });

  test('empty input returns empty array', () => {
    expect(computeScores([], [], {})).toEqual([]);
  });
});
