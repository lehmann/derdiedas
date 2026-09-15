'use strict';
const { test, describe } = require('node:test');
const assert             = require('node:assert/strict');
const { loadLookup }     = require('./helpers');

const { _needsE, _prs, _prät, conjugate } = loadLookup();

// ── _needsE ──────────────────────────────────────────────────────────────────

describe('_needsE', () => {
  const yes = (stem) => test(JSON.stringify(stem) + ' → true',  () => assert.equal(_needsE(stem), true));
  const no  = (stem) => test(JSON.stringify(stem) + ' → false', () => assert.equal(_needsE(stem), false));

  // t / d endings
  yes('arbeit');    // arbeiten
  yes('red');       // reden
  yes('bad');       // baden

  // consonant + n/m requiring -e-
  yes('öffn');      // öffnen  (f+n)
  yes('rechn');     // rechnen (h+n)
  yes('zeichn');    // zeichnen
  yes('regn');      // regnen  (g+n)
  yes('ordn');      // ordnen  (d+n)
  yes('atm');       // atmen   (t+m)
  yes('widm');      // widmen  (d+m)

  // sonorant l/r + n/m — NO insertion
  no('lern');       // lernen  (r+n)
  no('stürm');      // stürmen (r+m)
  no('film');       // filmen  (l+m)
  no('storm');      // stürmen variant

  // doubled consonant — NO insertion
  no('kämm');       // kämmen (mm)
  no('bremm');      // bremmen

  // vowel before consonant — NO insertion
  no('kauf');       // kaufen
  no('spiel');      // spielen
  no('les');        // lesen
});

// ── _prs (Präsens) ───────────────────────────────────────────────────────────

describe('_prs', () => {
  const P = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
  function prs(inf, data = {}) {
    return _prs(inf, data).reduce((acc, f, i) => { acc[P[i]] = f; return acc; }, {});
  }

  test('regular weak: kaufen', () => {
    const f = prs('kaufen');
    assert.equal(f['ich'],       'kaufe');
    assert.equal(f['du'],        'kaufst');
    assert.equal(f['er/sie/es'], 'kauft');
    assert.equal(f['wir'],       'kaufen');
    assert.equal(f['ihr'],       'kauft');
  });

  test('sibilant stem: heißen', () => {
    const f = prs('heißen');
    assert.equal(f['du'],        'heißt');   // sibilant → no extra s
    assert.equal(f['er/sie/es'], 'heißt');
  });

  test('e-insertion t/d: arbeiten', () => {
    const f = prs('arbeiten');
    assert.equal(f['du'],        'arbeitest');
    assert.equal(f['er/sie/es'], 'arbeitet');
    assert.equal(f['ihr'],       'arbeitet');
  });

  test('e-insertion consonant+n: öffnen', () => {
    const f = prs('öffnen');
    assert.equal(f['du'],        'öffnest');
    assert.equal(f['er/sie/es'], 'öffnet');
  });

  test('vowel-change p2/p3: fahren', () => {
    const f = prs('fahren', { p2: 'fährst', p3: 'fährt' });
    assert.equal(f['du'],        'fährst');
    assert.equal(f['er/sie/es'], 'fährt');
    assert.equal(f['wir'],       'fahren');  // unchanged
  });

  test('fully irregular prs array: sein', () => {
    const data = { prs: ['bin','bist','ist','sind','seid','sind'] };
    const f = prs('sein', data);
    assert.equal(f['ich'],       'bin');
    assert.equal(f['du'],        'bist');
    assert.equal(f['er/sie/es'], 'ist');
    assert.equal(f['wir'],       'sind');
    assert.equal(f['ihr'],       'seid');
    assert.equal(f['sie/Sie'],   'sind');
  });
});

// ── _prät (Präteritum) ───────────────────────────────────────────────────────

describe('_prät', () => {
  const P = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
  function prät(inf, data = {}) {
    return _prät(inf, data).reduce((acc, f, i) => { acc[P[i]] = f; return acc; }, {});
  }

  test('regular weak: kaufen', () => {
    const f = prät('kaufen');
    assert.equal(f['ich'],     'kaufte');
    assert.equal(f['du'],      'kauftest');
    assert.equal(f['wir'],     'kauften');
    assert.equal(f['ihr'],     'kauftet');
  });

  test('e-insertion t/d stem: arbeiten', () => {
    const f = prät('arbeiten');
    assert.equal(f['ich'],     'arbeitete');
    assert.equal(f['du'],      'arbeitetest');
    assert.equal(f['wir'],     'arbeiteten');
    assert.equal(f['ihr'],     'arbeitetet');
  });

  test('e-insertion consonant+n stem: öffnen', () => {
    const f = prät('öffnen');
    assert.equal(f['ich'],     'öffnete');
    assert.equal(f['du'],      'öffnetest');
    assert.equal(f['wir'],     'öffneten');
    assert.equal(f['ihr'],     'öffnetet');
  });

  test('stored full ich/er form ending in -e: begegnen', () => {
    const f = prät('begegnen', { pt: 'begegnete' });
    assert.equal(f['ich'],     'begegnete');
    assert.equal(f['du'],      'begegnetest');
    assert.equal(f['wir'],     'begegneten');   // NOT begegneteen
    assert.equal(f['ihr'],     'begegnetet');
  });

  test('strong irregular, no t/d: nehmen (pt=nahm)', () => {
    const f = prät('nehmen', { pt: 'nahm' });
    assert.equal(f['ich'],     'nahm');
    assert.equal(f['du'],      'nahmst');       // NOT nahmest
    assert.equal(f['wir'],     'nahmen');
    assert.equal(f['ihr'],     'nahmt');
  });

  test('strong irregular, no t/d: gehen (pt=ging)', () => {
    const f = prät('gehen', { pt: 'ging' });
    assert.equal(f['du'],      'gingst');
    assert.equal(f['wir'],     'gingen');
    assert.equal(f['ihr'],     'gingt');
  });

  test('strong irregular, t ending: bieten (pt=bot)', () => {
    const f = prät('bieten', { pt: 'bot' });
    assert.equal(f['du'],      'botest');       // t-ending → -e- inserted
    assert.equal(f['wir'],     'boten');
    assert.equal(f['ihr'],     'botet');
  });

  test('stored array form: sein', () => {
    const pt = ['war','warst','war','waren','wart','waren'];
    const f = prät('sein', { pt });
    assert.equal(f['ich'],     'war');
    assert.equal(f['du'],      'warst');
    assert.equal(f['wir'],     'waren');
    assert.equal(f['ihr'],     'wart');
  });
});

// ── conjugate (spot-checks across all 6 tenses) ──────────────────────────────

describe('conjugate', () => {
  function tense(tenses, name) {
    return Object.fromEntries(tenses.find(t => t.name === name).forms);
  }

  test('kaufen — regular haben verb', () => {
    const t = conjugate('kaufen', { a: 'h', pp: 'gekauft' });
    assert.equal(tense(t, 'Präsens')['ich'],          'kaufe');
    assert.equal(tense(t, 'Präteritum')['du'],         'kauftest');
    assert.equal(tense(t, 'Perfekt')['ich'],           'habe gekauft');
    assert.equal(tense(t, 'Plusquamperfekt')['ich'],   'hatte gekauft');
    assert.equal(tense(t, 'Futur I')['ich'],           'werde kaufen');
    assert.equal(tense(t, 'Futur II')['ich'],          'werde gekauft haben');
  });

  test('gehen — irregular sein verb', () => {
    const data = { a: 's', pp: 'gegangen', pt: 'ging' };
    const t = conjugate('gehen', data);
    assert.equal(tense(t, 'Präsens')['ich'],          'gehe');
    assert.equal(tense(t, 'Präteritum')['ich'],       'ging');
    assert.equal(tense(t, 'Perfekt')['ich'],          'bin gegangen');
    assert.equal(tense(t, 'Plusquamperfekt')['ich'],  'war gegangen');
    assert.equal(tense(t, 'Futur II')['ich'],         'werde gegangen sein');
  });

  test('sein — fully irregular', () => {
    const data = {
      a: 's', pp: 'gewesen',
      prs: ['bin','bist','ist','sind','seid','sind'],
      pt:  ['war','warst','war','waren','wart','waren'],
    };
    const t = conjugate('sein', data);
    assert.equal(tense(t, 'Präsens')['ich'],          'bin');
    assert.equal(tense(t, 'Präsens')['du'],           'bist');
    assert.equal(tense(t, 'Präteritum')['ich'],       'war');
    assert.equal(tense(t, 'Perfekt')['ich'],          'bin gewesen');
    assert.equal(tense(t, 'Futur II')['ich'],         'werde gewesen sein');
  });

  test('aufmachen — separable (sep=auf, base=machen)', () => {
    const data = { a: 'h', pp: 'aufgemacht', sep: 'auf' };
    const t = conjugate('aufmachen', data);
    // Präsens: conjugate base "machen", append "auf"
    assert.equal(tense(t, 'Präsens')['ich'],          'mache auf');
    assert.equal(tense(t, 'Präsens')['du'],           'machst auf');
    assert.equal(tense(t, 'Präsens')['er/sie/es'],    'macht auf');
    // Präteritum regular: machte auf
    assert.equal(tense(t, 'Präteritum')['ich'],       'machte auf');
    // Perfekt uses full pp (prefix already inside)
    assert.equal(tense(t, 'Perfekt')['ich'],          'habe aufgemacht');
    // Futur I uses full infinitive
    assert.equal(tense(t, 'Futur I')['ich'],          'werde aufmachen');
    assert.equal(tense(t, 'Futur II')['ich'],         'werde aufgemacht haben');
  });

  test('anfangen — separable with irregular forms', () => {
    const data = { a: 'h', pp: 'angefangen', sep: 'an', pt: 'fing', p2: 'fängst', p3: 'fängt' };
    const t = conjugate('anfangen', data);
    assert.equal(tense(t, 'Präsens')['ich'],          'fange an');
    assert.equal(tense(t, 'Präsens')['du'],           'fängst an');
    assert.equal(tense(t, 'Präsens')['er/sie/es'],    'fängt an');
    assert.equal(tense(t, 'Präteritum')['ich'],       'fing an');
    assert.equal(tense(t, 'Perfekt')['ich'],          'habe angefangen');
    assert.equal(tense(t, 'Futur I')['ich'],          'werde anfangen');
  });

  test('öffnen — e-insertion in both Präsens and Präteritum', () => {
    const data = { a: 'h', pp: 'geöffnet', p2: 'öffnest', p3: 'öffnet' };
    const t = conjugate('öffnen', data);
    assert.equal(tense(t, 'Präsens')['du'],           'öffnest');
    assert.equal(tense(t, 'Präteritum')['ich'],       'öffnete');
    assert.equal(tense(t, 'Präteritum')['du'],        'öffnetest');
    assert.equal(tense(t, 'Präteritum')['wir'],       'öffneten');
  });

  test('fahren — vowel change, sein aux', () => {
    const data = { a: 's', pp: 'gefahren', pt: 'fuhr', p2: 'fährst', p3: 'fährt' };
    const t = conjugate('fahren', data);
    assert.equal(tense(t, 'Präsens')['du'],           'fährst');
    assert.equal(tense(t, 'Präsens')['er/sie/es'],    'fährt');
    assert.equal(tense(t, 'Präteritum')['du'],        'fuhrst');
    assert.equal(tense(t, 'Perfekt')['ich'],          'bin gefahren');
    assert.equal(tense(t, 'Futur II')['ich'],         'werde gefahren sein');
  });

  test('tenses array has exactly 6 entries with correct names', () => {
    const t = conjugate('kaufen', { a: 'h', pp: 'gekauft' });
    assert.equal(t.length, 6);
    // Compare as joined string to avoid vm-context reference-equality issues
    assert.equal(t.map(x => x.name).join('|'),
      'Präsens|Präteritum|Perfekt|Plusquamperfekt|Futur I|Futur II');
    t.forEach(tense => assert.equal(tense.forms.length, 6));
  });
});
