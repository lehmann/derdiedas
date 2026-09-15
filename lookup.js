// ── Verb helpers ──────────────────────────────────────────────────────────────

let _verbCache = null;
let _verbLoading = null;
let _verbFormMap = null;

function loadVerbDictionary() {
  if (_verbCache) return Promise.resolve(_verbCache);
  if (_verbLoading) return _verbLoading;
  _verbLoading = fetch(chrome.runtime.getURL('data/verbs.json'))
    .then(r => r.json())
    .then(verbs => {
      _verbCache = verbs;
      _verbFormMap = buildVerbFormMap(verbs);
      _verbLoading = null;
      return verbs;
    });
  return _verbLoading;
}

function buildVerbFormMap(verbs) {
  const map = {};
  for (const [inf, d] of Object.entries(verbs)) {
    if (d.pp) map[d.pp] = inf;
    if (d.p2) map[d.p2] = inf;
    if (d.p3) map[d.p3] = inf;
    if (typeof d.pt === 'string') {
      const s = d.pt;
      const ne = /[td]$/.test(s);
      [s, s + (ne ? 'est' : 'st'), s + 'en', s + (ne ? 'et' : 't')].forEach(f => { map[f] = inf; });
    } else if (Array.isArray(d.pt)) {
      d.pt.forEach(f => { map[f] = inf; });
    }
    if (Array.isArray(d.prs)) d.prs.forEach(f => { map[f] = inf; });
  }
  return map;
}

async function lookupVerb(word) {
  const key = word.toLowerCase();
  const verbs = await loadVerbDictionary();

  if (verbs[key]) return { infinitive: key, data: verbs[key] };

  const fromMap = _verbFormMap[key];
  if (fromMap) return { infinitive: fromMap, data: verbs[fromMap] };

  // Strip common Präsens endings to derive infinitive
  for (const sfx of ['est', 'st', 'et', 'e', 'en', 't']) {
    if (key.endsWith(sfx)) {
      const stem = key.slice(0, -sfx.length);
      const inf  = stem + 'en';
      if (verbs[inf]) return { infinitive: inf, data: verbs[inf] };
    }
  }

  return null;
}

function conjugate(infinitive, data) {
  const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
  const aux = data.a || 'h';
  const pp  = data.pp;

  const prs = (() => {
    if (data.prs) return data.prs;
    const stem = infinitive.slice(0, -2);
    const sib  = /[sßzx]$/.test(stem);
    const needE = /[td]$/.test(stem);
    return [
      stem + 'e',
      data.p2 || stem + (sib ? 't' : needE ? 'est' : 'st'),
      data.p3 || stem + (needE ? 'et' : 't'),
      infinitive,
      stem + (needE ? 'et' : 't'),
      infinitive,
    ];
  })();

  const prät = (() => {
    if (Array.isArray(data.pt)) return data.pt;
    if (typeof data.pt === 'string') {
      const s  = data.pt;
      const ne = /[td]$/.test(s);
      return [s, s + (ne ? 'est' : 'st'), s, s + 'en', s + (ne ? 'et' : 't'), s + 'en'];
    }
    const stem  = infinitive.slice(0, -2);
    const needE = /[td]$/.test(stem);
    const ts    = stem + (needE ? 'ete' : 'te');
    return [ts, ts + 'st', ts, ts + 'n', ts + 't', ts + 'n'];
  })();

  const hPrs  = ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'];
  const sPrs  = ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'];
  const hPrät = ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'];
  const sPrät = ['war', 'warst', 'war', 'waren', 'wart', 'waren'];
  const wPrs  = ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'];

  const auxPrs  = aux === 's' ? sPrs  : hPrs;
  const auxPrät = aux === 's' ? sPrät : hPrät;
  const auxInf  = aux === 's' ? 'sein' : 'haben';

  return [
    { name: 'Präsens',         forms: prs.map((f, i)    => [PERSONS[i], f]) },
    { name: 'Präteritum',      forms: prät.map((f, i)   => [PERSONS[i], f]) },
    { name: 'Perfekt',         forms: auxPrs.map((a, i)  => [PERSONS[i], `${a} ${pp}`]) },
    { name: 'Plusquamperfekt', forms: auxPrät.map((a, i) => [PERSONS[i], `${a} ${pp}`]) },
    { name: 'Futur I',         forms: wPrs.map((w, i)    => [PERSONS[i], `${w} ${infinitive}`]) },
    { name: 'Futur II',        forms: wPrs.map((w, i)    => [PERSONS[i], `${w} ${pp} ${auxInf}`]) },
  ];
}

// ── Noun helpers ──────────────────────────────────────────────────────────────

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
