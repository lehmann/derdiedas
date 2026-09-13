// Suffix rules ordered longest-first to ensure specificity (e.g. "ment" matched before "ent")
const SUFFIX_RULES = [
  { suffix: 'schaft', gender: 'f', min: 8 },
  { suffix: 'ismus',  gender: 'm', min: 7 },
  { suffix: 'chen',   gender: 'n', min: 6 },
  { suffix: 'lein',   gender: 'n', min: 6 },
  { suffix: 'ment',   gender: 'n', min: 6 },
  { suffix: 'heit',   gender: 'f', min: 6 },
  { suffix: 'keit',   gender: 'f', min: 6 },
  { suffix: 'tion',   gender: 'f', min: 6 },
  { suffix: 'ling',   gender: 'm', min: 6 },
  { suffix: 'tät',    gender: 'f', min: 5 },
  { suffix: 'ung',    gender: 'f', min: 5 },
  { suffix: 'ant',    gender: 'm', min: 5 },
  { suffix: 'ent',    gender: 'm', min: 5 },
  { suffix: 'ist',    gender: 'm', min: 5 },
  { suffix: 'anz',    gender: 'f', min: 5 },
  { suffix: 'enz',    gender: 'f', min: 5 },
  { suffix: 'ium',    gender: 'n', min: 5 },
  { suffix: 'tum',    gender: 'n', min: 5 },
  { suffix: 'ik',     gender: 'f', min: 4 },
  { suffix: 'ur',     gender: 'f', min: 4 },
  { suffix: 'ie',     gender: 'f', min: 5 },
];

const ARTICLES = { m: 'der', f: 'die', n: 'das' };

let _cache = null;
let _loading = null;

function loadDictionary() {
  if (_cache) return Promise.resolve(_cache);
  if (_loading) return _loading;

  _loading = Promise.all([
    fetch(chrome.runtime.getURL('data/nouns.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('data/exceptions.json')).then(r => r.json()),
  ]).then(([nouns, exceptions]) => {
    _cache = { nouns, exceptions };
    _loading = null;
    return _cache;
  });

  return _loading;
}

async function lookupWord(word) {
  const key = word.toLowerCase();
  if (key.length < 2 || /\s/.test(key)) return null;

  const { nouns, exceptions } = await loadDictionary();

  // Tier 1: frequency dictionary (~700 sample, full ~20k via process_kaikki.py)
  if (nouns[key] !== undefined) {
    return { article: ARTICLES[nouns[key]], source: 'dict' };
  }

  // Tier 2a: exceptions — known violations of suffix rules (checked before rules fire)
  if (exceptions[key] !== undefined) {
    return { article: ARTICLES[exceptions[key]], source: 'exception' };
  }

  // Tier 2b: high-confidence suffix rules
  for (const rule of SUFFIX_RULES) {
    if (key.length >= rule.min && key.endsWith(rule.suffix)) {
      return { article: ARTICLES[rule.gender], source: 'rule' };
    }
  }

  return null;
}
