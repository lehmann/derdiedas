'use strict';
const { createContext, runInContext } = require('vm');
const { readFileSync }                = require('fs');
const { join }                        = require('path');

/**
 * Load lookup.js into a vm context with a minimal Chrome API mock.
 * Returns the context object — all global functions defined in lookup.js
 * (e.g. _needsE, _prs, _prät, conjugate, buildVerbFormMap, lookupVerb)
 * are accessible as properties on it.
 */
function loadLookup(verbsFixture = {}) {
  const ctx = createContext({
    chrome: { runtime: { getURL: p => p } },
    fetch:  () => Promise.resolve({ json: () => Promise.resolve(verbsFixture) }),
    Promise,
    console,
  });
  const src = readFileSync(join(__dirname, '..', 'lookup.js'), 'utf8');
  runInContext(src, ctx);
  return ctx;
}

module.exports = { loadLookup };
