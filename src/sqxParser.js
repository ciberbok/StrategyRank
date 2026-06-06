const JSZip = require('jszip');
const { parseStringPromise } = require('xml2js');

// parseSqxFile: given a Buffer (or Uint8Array) containing a .sqx file,
// return a strategy descriptor containing entry/price indicators and a variable map.
async function parseSqxFile(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  // strategy data is stored in strategy_Portfolio.xml (experiments show this holds definitions)
  const xmlEntry = zip.file('strategy_Portfolio.xml');
  if (!xmlEntry) {
    throw new Error('strategy_Portfolio.xml not found in SQX archive');
  }
  const xml = await xmlEntry.async('string');
  const root = await parseStringPromise(xml, { explicitArray: false });

  // create output object
  const strategy = {
    strategyId: '',
    name: '',
    entryIndicators: [],
    priceIndicators: [],
    variableMap: {}, // id -> indicator object
  };

  // obtain basic metadata
  if (root && root.StrategyFile && root.StrategyFile.Strategy) {
    const strat = root.StrategyFile.Strategy;
    if (strat.$ && strat.$.name) strategy.name = strat.$.name;
  }

  // utility to add indicator
  function addIndicator(indicator, context) {
    if (context === 'entry') strategy.entryIndicators.push(indicator);
    else if (context === 'price') strategy.priceIndicators.push(indicator);
  }

  // traverse the xml structure recursively
  function traverse(node, path = []) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => traverse(n, path));
      return;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (key === 'signal' && child && typeof child === 'object') {
        // handle signal definitions with variable IDs
        const entries = Array.isArray(child) ? child : [child];
        entries.forEach((sig) => {
          const id = sig.$ && sig.$.variable;
          if (id && sig.Item) {
            const item = sig.Item;
            const indicator = buildIndicatorFromItem(item);
            if (indicator) {
              // record id on the indicator itself
              indicator.id = id;
              // store in map so BooleanVariable references can be resolved later
              strategy.variableMap[id] = indicator;
              // signals themselves are essentially entry indicators
              addIndicator(indicator, 'entry');
            }
          }
        });
      }
      if (key === 'Item') {
        const entries = Array.isArray(child) ? child : [child];
        entries.forEach((item) => {
          processItem(item, path);
        });
      }
      traverse(child, path.concat(key));
    }
  }

  function processItem(item, path) {
    const attrs = item.$ || {};
    // build indicator object if item has mI attribute
    if (attrs.mI) {
      const indicator = buildIndicatorFromItem(item);
      // determine context: entry if under "If" or "signals" nodes, or boolean returnType
      const isEntry = path.includes('If') || path.includes('signals') || attrs.returnType === 'boolean';
      addIndicator(indicator, isEntry ? 'entry' : 'price');
    }
    // also watch for BooleanVariable items that reference other indicators
    if (attrs.key === 'BooleanVariable' && item.Param) {
      const param = Array.isArray(item.Param) ? item.Param[0] : item.Param;
      if (param && param.$ && param.$.variable === 'true' && param._) {
        // record reference placeholder; actual resolution happens later
        strategy.variableMap[param._] =
          strategy.variableMap[param._] || { reference: true, id: param._ };
      }
    }
  }

  function buildIndicatorFromItem(item) {
    const attrs = item.$ || {};
        const indicator = {
      id: attrs.id || null,
      key: attrs.key || null,
      name: attrs.name || attrs.key || null,
      mI: attrs.mI || null,
      returnType: attrs.returnType || null,
      categoryType: attrs.categoryType || null,
      params: [],
    };
    if (item.Param) {
      const params = Array.isArray(item.Param) ? item.Param : [item.Param];
      params.forEach((p) => {
        const pAttrs = p.$ || {};
        indicator.params.push({
          key: pAttrs.key || null,
          value: p._ !== undefined ? p._ : null,
          attrs: pAttrs,
        });
      });
    }
    return indicator;
  }

  traverse(root);
  return strategy;
}

module.exports = { parseSqxFile };
