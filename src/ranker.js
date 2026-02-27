// Core ranking logic extracted from strategy-rank.html

/**
 * Compute percentile rank for a value given a sorted ascending array.
 * Mirrors original app's pctRank function.
 */
function pctRank(sorted, val) {
  let below = 0, eq = 0;
  for (const v of sorted) {
    if (v < val) below++;
    else if (v === val) eq++;
  }
  if (sorted.length <= 1) return 0.5;
  return (below + eq / 2) / (sorted.length - 1);
}

/**
 * Auto-distribute weights evenly across the supplied KPI list.
 * Remainder (due to floating rounding) is added to the first KPI.
 * Returns an object mapping column->weight (number).
 */
function autoDistribute(selKpis) {
  const n = selKpis.length;
  if (!n) return {};
  const w = parseFloat((100 / n).toFixed(1));
  const rem = parseFloat((100 - w * n).toFixed(1));
  const out = {};
  selKpis.forEach((col, i) => {
    const v = parseFloat((w + (i === 0 ? rem : 0)).toFixed(1));
    out[col] = v;
  });
  return out;
}

/**
 * Compute ranked results from rows data.
 *
 * @param {Array<Object>} rows - raw data rows (objects mapping col->value)
 * @param {Array<string>} selKpis - list of KPI column names to include
 * @param {Object} kpiCfg - configuration object mapping KPI-> {weight:number, dir:'more'|'less'}
 *
 * @returns {Array<Object>} ranked rows; each row has additional keys:
 *   __idx: original index
 *   __score: numeric score scaled 0-100
 *   __pcts: object mapping KPI->percentile value (0..1)
 */
function computeScores(rows, selKpis, kpiCfg) {
  if (!rows.length || !selKpis.length) return [];

  // build sorted value lists per KPI
  const sorted = {};
  selKpis.forEach(col => {
    sorted[col] = rows
      .map(r => parseFloat(r[col]))
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);
  });

  const ranked = rows.map((row, idx) => {
    let score = 0;
    const pcts = {};
    selKpis.forEach(col => {
      const val = parseFloat(row[col]);
      if (isNaN(val)) return;
      let p = pctRank(sorted[col], val);
      if (kpiCfg[col] && kpiCfg[col].dir === 'less') p = 1 - p;
      pcts[col] = p;
      const weight = kpiCfg[col] ? kpiCfg[col].weight || 0 : 0;
      score += p * (weight / 100);
    });
    return { ...row, __idx: idx, __score: score * 100, __pcts: pcts };
  });

  ranked.sort((a, b) => b.__score - a.__score);
  return ranked;
}

module.exports = { pctRank, computeScores, autoDistribute };
