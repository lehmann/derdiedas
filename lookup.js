// ── Verb helpers ──────────────────────────────────────────────────────────────

let _verbCache = null;
let _verbLoading = null;
let _verbFormMap = null;
let _verbTranslationsPt = null;

function loadVerbDictionary() {
  if (_verbCache) return Promise.resolve(_verbCache);
  if (_verbLoading) return _verbLoading;
  _verbLoading = Promise.all([
    fetch(chrome.runtime.getURL('data/verbs.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('data/verb_translations_pt.json')).then(r => r.json()).catch(() => ({})),
  ]).then(([verbs, translations]) => {
    _verbCache = verbs;
    _verbTranslationsPt = translations;
    _verbFormMap = buildVerbFormMap(verbs);
    _verbLoading = null;
    return verbs;
  });
  return _verbLoading;
}

function buildVerbFormMap(verbs) {
  const map = {};
  for (const [inf, d] of Object.entries(verbs)) {
    // pp is always indexed (prefix makes it unique for separable verbs too)
    if (d.pp) map[d.pp] = inf;
    // For separable verbs stop here — their Präsens/Präteritum forms are
    // shared with their base verb and would cause ambiguous lookups
    if (d.sep) continue;
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

  // Strip common endings (Präsens and Präteritum weak) to derive infinitive.
  // 'ete'/'te' before 'et'/'e' so longer suffixes match first.
  for (const sfx of ['est', 'st', 'ete', 'te', 'et', 'e', 'en', 't']) {
    if (key.endsWith(sfx)) {
      const stem = key.slice(0, -sfx.length);
      const inf  = stem + 'en';
      if (verbs[inf]) return { infinitive: inf, data: verbs[inf] };
    }
  }

  return null;
}

// -e- insertion rule: stems ending in t/d, OR in n/m preceded by a hard consonant
// (e.g. öffn, rechn, atm, widm) but NOT after l/r (lern, stürm) or doubled consonant (kämm).
function _needsE(stem) {
  if (/[td]$/.test(stem)) return true;
  if (/[nm]$/.test(stem)) {
    const prev = stem.slice(-2, -1);
    return prev.length === 1 && !/[aeiouäöülr]/.test(prev) && prev !== stem.slice(-1);
  }
  return false;
}

// Derive Präsens forms for a given infinitive + data (without sep prefix)
function _prs(inf, data) {
  if (data.prs) return data.prs;
  const stem  = inf.slice(0, -2);
  const sib   = /[sßzx]$/.test(stem);
  const needE = _needsE(stem);
  return [
    stem + 'e',
    data.p2 || stem + (sib ? 't' : needE ? 'est' : 'st'),
    data.p3 || stem + (needE ? 'et' : 't'),
    inf,
    stem + (needE ? 'et' : 't'),
    inf,
  ];
}

// Derive Präteritum forms for a given infinitive + data (without sep prefix)
function _prät(inf, data) {
  if (Array.isArray(data.pt)) return data.pt;
  if (typeof data.pt === 'string') {
    const s = data.pt;
    if (s.endsWith('e')) {
      // CSV stored the full ich/er form (e.g. "begegnete", "öffnete") —
      // derive the remaining persons by appending n/st/t directly.
      return [s, s + 'st', s, s + 'n', s + 't', s + 'n'];
    }
    // For stored strong-verb stems (nahm, bot, ging…) only t/d endings need -e-
    // insertion (bot→botest). The consonant+n/m rule (_needsE) is for infinitive
    // stems only and must NOT fire here — "nahm" gives "nahmst", not "nahmest".
    const ne = /[td]$/.test(s);
    return [s, s + (ne ? 'est' : 'st'), s, s + 'en', s + (ne ? 'et' : 't'), s + 'en'];
  }
  const stem  = inf.slice(0, -2);
  const ts    = stem + (_needsE(stem) ? 'ete' : 'te');
  return [ts, ts + 'st', ts, ts + 'n', ts + 't', ts + 'n'];
}

function conjugate(infinitive, data) {
  const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
  const aux = data.a || 'h';
  const pp  = data.pp;

  // For separable verbs conjugate the base verb, then append the prefix
  const baseInf = data.sep ? infinitive.slice(data.sep.length) : infinitive;
  const rawPrs  = _prs(baseInf, data);
  const rawPrät = _prät(baseInf, data);
  const prs  = data.sep ? rawPrs.map(f => `${f} ${data.sep}`)  : rawPrs;
  const prät = data.sep ? rawPrät.map(f => `${f} ${data.sep}`) : rawPrät;

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
