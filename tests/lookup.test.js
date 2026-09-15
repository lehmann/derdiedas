'use strict';
const { test, describe, before } = require('node:test');
const assert                     = require('node:assert/strict');
const { loadLookup }             = require('./helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VERBS_FIXTURE = {
  kaufen:    { a: 'h', pp: 'gekauft' },
  gehen:     { a: 's', pp: 'gegangen',   pt: 'ging' },
  fahren:    { a: 's', pp: 'gefahren',   pt: 'fuhr', p2: 'fährst', p3: 'fährt' },
  sehen:     { a: 'h', pp: 'gesehen',    pt: 'sah',  p2: 'siehst', p3: 'sieht' },
  sein:      { a: 's', pp: 'gewesen',    prs: ['bin','bist','ist','sind','seid','sind'], pt: ['war','warst','war','waren','wart','waren'] },
  aufmachen: { a: 'h', pp: 'aufgemacht', sep: 'auf' },
  aufgehen:  { a: 's', pp: 'aufgegangen', sep: 'auf', pt: 'ging' },
  arbeiten:  { a: 'h', pp: 'gearbeitet' },
};

// ── buildVerbFormMap ──────────────────────────────────────────────────────────

describe('buildVerbFormMap', () => {
  const { buildVerbFormMap } = loadLookup();
  const map = buildVerbFormMap(VERBS_FIXTURE);

  test('pp maps to infinitive: gekauft → kaufen', () =>
    assert.equal(map['gekauft'], 'kaufen'));

  test('pp maps to infinitive: gegangen → gehen', () =>
    assert.equal(map['gegangen'], 'gehen'));

  test('strong pt forms map: ging → gehen', () =>
    assert.equal(map['ging'], 'gehen'));

  test('strong pt du form maps: gingst → gehen', () =>
    assert.equal(map['gingst'], 'gehen'));

  test('strong pt wir form maps: gingen → gehen', () =>
    assert.equal(map['gingen'], 'gehen'));

  test('vowel-change p2 maps: fährst → fahren', () =>
    assert.equal(map['fährst'], 'fahren'));

  test('vowel-change p3 maps: fährt → fahren', () =>
    assert.equal(map['fährt'], 'fahren'));

  test('prs array maps: bin → sein', () =>
    assert.equal(map['bin'], 'sein'));

  test('prs array maps: bist → sein', () =>
    assert.equal(map['bist'], 'sein'));

  test('separable: pp maps (aufgemacht → aufmachen)', () =>
    assert.equal(map['aufgemacht'], 'aufmachen'));

  test('separable: base pt forms do NOT map to sep verb (ambiguous with base)', () => {
    // "ging" should map to gehen, not aufgehen — sep verbs are skipped
    assert.equal(map['ging'], 'gehen');
    assert.equal(map['aufgegangen'], 'aufgehen');  // but pp is unambiguous
  });
});

// ── lookupVerb ────────────────────────────────────────────────────────────────

describe('lookupVerb', () => {
  // Pre-warm the verb cache so lookupVerb doesn't need fetch
  let ctx;
  before(async () => {
    ctx = loadLookup(VERBS_FIXTURE);
    // Trigger cache load so _verbCache and _verbFormMap are populated
    await ctx.loadVerbDictionary();
  });

  async function lookup(word) {
    return ctx.lookupVerb(word);
  }

  test('exact infinitive match: kaufen', async () => {
    const r = await lookup('kaufen');
    assert.equal(r?.infinitive, 'kaufen');
  });

  test('exact infinitive match: sein', async () => {
    const r = await lookup('sein');
    assert.equal(r?.infinitive, 'sein');
  });

  test('form map — Partizip II: gegangen → gehen', async () => {
    const r = await lookup('gegangen');
    assert.equal(r?.infinitive, 'gehen');
  });

  test('form map — strong Präteritum: ging → gehen', async () => {
    const r = await lookup('ging');
    assert.equal(r?.infinitive, 'gehen');
  });

  test('form map — vowel-change du: fährst → fahren', async () => {
    const r = await lookup('fährst');
    assert.equal(r?.infinitive, 'fahren');
  });

  test('form map — Präteritum du: gingst → gehen', async () => {
    const r = await lookup('gingst');
    assert.equal(r?.infinitive, 'gehen');
  });

  test('stem stripping — 3rd person present: kauft → kaufen', async () => {
    const r = await lookup('kauft');
    assert.equal(r?.infinitive, 'kaufen');
  });

  test('stem stripping — 2nd person present: kaufst → kaufen', async () => {
    const r = await lookup('kaufst');
    assert.equal(r?.infinitive, 'kaufen');
  });

  test('stem stripping — 1st person: kaufe → kaufen', async () => {
    const r = await lookup('kaufe');
    assert.equal(r?.infinitive, 'kaufen');
  });

  test('stem stripping — Präteritum weak -te: kaufte → kaufen', async () => {
    const r = await lookup('kaufte');
    assert.equal(r?.infinitive, 'kaufen');
  });

  test('stem stripping — Präteritum weak -ete: arbeitete → arbeiten', async () => {
    const r = await lookup('arbeitete');
    assert.equal(r?.infinitive, 'arbeiten');
  });

  test('returns null for unknown word', async () => {
    const r = await lookup('xyzfoo');
    assert.equal(r, null);
  });

  test('case insensitive: KAUFEN → kaufen', async () => {
    const r = await lookup('KAUFEN');
    assert.equal(r?.infinitive, 'kaufen');
  });
});
